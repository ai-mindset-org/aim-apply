// submit.js — Netlify Function to receive assessment submissions
//
// Accepts two payload shapes:
//
//   1. NEW (plugin v0.1.0+) — written to submissions/{role}/{session_id}.json
//      {
//        session_id, role, events: [...], artifacts: { profile, task_output,
//        reflection }, consent: true, plugin_version, consent_ts
//      }
//
//   2. LEGACY (web form) — written to {date}-{safeName}/... as before
//      { candidate, direction, date, scores, files, tracking }
//
// Writes to private repo ai-mindset-org/aim-apply-submissions via the GitHub
// Contents API. If GITHUB_SUBMISSIONS_TOKEN is missing or the repo returns
// 404, responds 503 with a graceful "backend not configured" message — this
// is a known pending step, the plugin retry logic handles it.

const GITHUB_TOKEN = process.env.GITHUB_SUBMISSIONS_TOKEN;
const SUBMISSIONS_REPO = "ai-mindset-org/aim-apply-submissions";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const MAX_PAYLOAD_BYTES = 500 * 1024; // 500 KB
const ALLOWED_ROLES = new Set([
  "general",
  "marketing",
  "automation",
  "visual",
  "ops",
]);

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function jsonResponse(statusCode, body) {
  return {
    statusCode,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}

function isNewShape(payload) {
  return (
    payload &&
    typeof payload === "object" &&
    typeof payload.session_id === "string" &&
    typeof payload.role === "string" &&
    Array.isArray(payload.events) &&
    payload.artifacts &&
    typeof payload.artifacts === "object"
  );
}

// PUT a single file to the private submissions repo via the Contents API.
// Throws with { status, message } on non-2xx.
async function commitFile(path, content, commitMessage) {
  const apiUrl = `https://api.github.com/repos/${SUBMISSIONS_REPO}/contents/${path}`;
  const res = await fetch(apiUrl, {
    method: "PUT",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      "Content-Type": "application/json",
      Accept: "application/vnd.github.v3+json",
    },
    body: JSON.stringify({
      message: commitMessage,
      content: Buffer.from(content).toString("base64"),
    }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(`github ${res.status}: ${text.slice(0, 200)}`);
    err.status = res.status;
    throw err;
  }
  return res.json().catch(() => ({}));
}

// Sanitize candidate name (legacy path) for folder use.
function safeFolderName(name) {
  return String(name || "unknown")
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);
}

// ---------------------------------------------------------------------------
// New-shape handler
// ---------------------------------------------------------------------------

async function handleNewShape(payload, rawBodyLength) {
  const {
    session_id,
    role,
    events,
    artifacts,
    consent,
    plugin_version,
    consent_ts,
  } = payload;

  // consent must be explicit true
  if (consent !== true) {
    return jsonResponse(400, { error: "consent_required" });
  }

  // required fields
  if (!session_id || !role || !Array.isArray(events) || !artifacts) {
    return jsonResponse(400, { error: "missing_required_fields" });
  }

  // role allowlist
  if (!ALLOWED_ROLES.has(role)) {
    return jsonResponse(400, {
      error: "invalid_role",
      allowed: [...ALLOWED_ROLES],
    });
  }

  // session_id sanity — alphanumeric + dash + underscore, max 64
  if (!/^[a-zA-Z0-9_-]{1,64}$/.test(session_id)) {
    return jsonResponse(400, { error: "invalid_session_id" });
  }

  // size cap
  if (rawBodyLength > MAX_PAYLOAD_BYTES) {
    return jsonResponse(413, {
      error: "payload_too_large",
      max_bytes: MAX_PAYLOAD_BYTES,
      received_bytes: rawBodyLength,
    });
  }

  // artifacts shape — all three keys must be strings (empty string ok)
  const { profile = "", task_output = "", reflection = "" } = artifacts;
  if (
    typeof profile !== "string" ||
    typeof task_output !== "string" ||
    typeof reflection !== "string"
  ) {
    return jsonResponse(400, { error: "invalid_artifacts" });
  }

  // backend gate
  if (!GITHUB_TOKEN) {
    return jsonResponse(503, {
      error: "backend_not_configured",
      message: "submissions backend not configured yet",
    });
  }

  // Build the single JSON file
  const submission = {
    session_id,
    role,
    plugin_version: plugin_version || "unknown",
    consent: true,
    consent_ts: consent_ts || new Date().toISOString(),
    received_at: new Date().toISOString(),
    events,
    artifacts: { profile, task_output, reflection },
  };

  const path = `submissions/${role}/${session_id}.json`;
  const commitMessage = `apply: ${role} ${session_id}`;

  try {
    await commitFile(path, JSON.stringify(submission, null, 2), commitMessage);
  } catch (err) {
    // 404 on repo → repo doesn't exist yet → graceful 503
    if (err.status === 404) {
      return jsonResponse(503, {
        error: "backend_not_configured",
        message: "submissions backend not configured yet",
      });
    }
    // 422 usually means file already exists at that path — treat as conflict
    if (err.status === 422) {
      return jsonResponse(409, {
        error: "session_already_submitted",
        session_id,
      });
    }
    console.error("submit (new): commit failed", err);
    return jsonResponse(500, { error: "submission_failed" });
  }

  return jsonResponse(200, { status: "ok", session_id });
}

// ---------------------------------------------------------------------------
// Legacy handler — kept for backward compat with the web form
// ---------------------------------------------------------------------------

async function handleLegacyShape(payload) {
  const {
    candidate = "unknown",
    direction = "unknown",
    date,
    scores,
    files,
    tracking,
  } = payload;

  if (!GITHUB_TOKEN) {
    return jsonResponse(503, {
      error: "backend_not_configured",
      message: "submissions backend not configured yet",
    });
  }

  const folderPath = `${date}-${safeFolderName(candidate)}`;
  const filesToCommit = [];

  if (scores) {
    filesToCommit.push({
      path: `${folderPath}/scores.json`,
      content: JSON.stringify(scores, null, 2),
    });
  }

  if (files) {
    for (const [filename, content] of Object.entries(files)) {
      filesToCommit.push({
        path: `${folderPath}/outputs/${filename}`,
        content:
          typeof content === "string" ? content : JSON.stringify(content),
      });
    }
  }

  if (tracking) {
    if (tracking.session) {
      filesToCommit.push({
        path: `${folderPath}/tracking/session.jsonl`,
        content:
          typeof tracking.session === "string"
            ? tracking.session
            : JSON.stringify(tracking.session),
      });
    }
    if (tracking.profile) {
      filesToCommit.push({
        path: `${folderPath}/tracking/profile.json`,
        content: JSON.stringify(tracking.profile, null, 2),
      });
    }
  }

  try {
    for (const file of filesToCommit) {
      await commitFile(
        file.path,
        file.content,
        `apply (legacy): ${candidate} – ${direction}`
      );
    }
  } catch (err) {
    if (err.status === 404) {
      return jsonResponse(503, {
        error: "backend_not_configured",
        message: "submissions backend not configured yet",
      });
    }
    console.error("submit (legacy): commit failed", err);
    return jsonResponse(500, { error: "submission_failed" });
  }

  return {
    statusCode: 201,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
    body: JSON.stringify({
      success: true,
      message: "submitted",
      folder: folderPath,
    }),
  };
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "POST") {
    return jsonResponse(405, { error: "method_not_allowed" });
  }

  const rawBody = event.body || "";
  const rawBodyLength = Buffer.byteLength(rawBody, "utf8");

  // Early size check — applies to both shapes
  if (rawBodyLength > MAX_PAYLOAD_BYTES) {
    return jsonResponse(413, {
      error: "payload_too_large",
      max_bytes: MAX_PAYLOAD_BYTES,
      received_bytes: rawBodyLength,
    });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody);
  } catch (e) {
    return jsonResponse(400, { error: "invalid_json" });
  }

  if (isNewShape(payload)) {
    return handleNewShape(payload, rawBodyLength);
  }
  return handleLegacyShape(payload);
}
