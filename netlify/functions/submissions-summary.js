// submissions-summary.js — Netlify Function that aggregates apply submissions
// for the analytics dashboard.
//
// Reads from the private repo ai-mindset-org/aim-apply-submissions via the
// GitHub Contents API, aggregates by role / phase / day, returns ONLY
// aggregates. Individual submission content is never returned.
//
// Graceful degradation: if the GitHub token is missing or the repo returns
// 404, responds 200 with an empty shape + errors[] so the dashboard doesn't
// break.
//
// Style modelled on umami-stats-extended.js: Promise.allSettled for per-role
// fetches, CORS, error gathering, 30s cache.

const GITHUB_TOKEN = process.env.GITHUB_SUBMISSIONS_TOKEN;
const SUBMISSIONS_REPO = "ai-mindset-org/aim-apply-submissions";
const GITHUB_API = "https://api.github.com";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DAY = 24 * 60 * 60 * 1000;

const ALL_ROLES = ["general", "marketing", "automation", "visual", "ops"];

// Phase allowlist — matches _logging.md. Anything else is ignored.
const PHASES = ["profile", "task", "reflection"];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildRange(period) {
  const endAt = Date.now();
  let length;
  switch (period) {
    case "7d":
      length = 7 * DAY;
      break;
    case "30d":
      length = 30 * DAY;
      break;
    case "all":
      length = 365 * 5 * DAY; // effectively unbounded
      break;
    default:
      length = 7 * DAY;
  }
  return { startAt: endAt - length, endAt, length };
}

function emptyFunnel() {
  return {
    started: 0,
    profile_done: 0,
    task_done: 0,
    reflection_done: 0,
    submitted: 0,
  };
}

function emptyByRole() {
  const out = {};
  for (const r of ALL_ROLES) out[r] = 0;
  return out;
}

function emptyPhaseDurations() {
  const out = {};
  for (const p of PHASES) out[p] = { sum_ms: 0, count: 0, avg_ms: 0 };
  return out;
}

function emptyResponse(context, period, errors = []) {
  return {
    context,
    period,
    generated_at: new Date().toISOString(),
    total: 0,
    by_role: emptyByRole(),
    funnel: emptyFunnel(),
    avg_duration_per_phase: {
      profile: 0,
      task: 0,
      reflection: 0,
    },
    drop_off: {
      after_profile: 0,
      after_task: 0,
      after_reflection: 0,
    },
    timeseries: [],
    errors,
  };
}

// GET wrapper for GitHub API. Throws on non-2xx.
async function fetchGitHub(path) {
  const url = `${GITHUB_API}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: "application/vnd.github.v3+json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    const err = new Error(
      `${res.status} ${res.statusText}: ${text.slice(0, 200)}`
    );
    err.status = res.status;
    err.path = path;
    throw err;
  }
  return res.json();
}

async function settle(label, promise) {
  try {
    const value = await promise;
    return { label, ok: true, value };
  } catch (error) {
    return { label, ok: false, error };
  }
}

function recordError(errors, endpoint, err) {
  const reason =
    err?.status != null
      ? `${err.status} ${String(err.message || "").slice(0, 160)}`
      : String(err?.message || err || "unknown");
  console.warn(`submissions-summary: ${endpoint} failed → ${reason}`);
  errors.push({ endpoint, reason });
}

// List files in submissions/{role}. Returns [] on 404 (empty folder), throws
// otherwise.
async function listRole(role) {
  try {
    const items = await fetchGitHub(
      `/repos/${SUBMISSIONS_REPO}/contents/submissions/${role}`
    );
    if (!Array.isArray(items)) return [];
    return items.filter((it) => it.type === "file" && it.name.endsWith(".json"));
  } catch (err) {
    if (err.status === 404) return [];
    throw err;
  }
}

// Fetch and parse a single submission file. Returns null on error.
async function fetchSubmission(role, file) {
  try {
    // download_url is a direct raw content URL — cheaper than going through
    // the contents API again.
    if (file.download_url) {
      const res = await fetch(file.download_url, {
        headers: { Authorization: `Bearer ${GITHUB_TOKEN}` },
      });
      if (!res.ok) return null;
      return await res.json();
    }
    const data = await fetchGitHub(
      `/repos/${SUBMISSIONS_REPO}/contents/submissions/${role}/${file.name}`
    );
    if (data?.content) {
      const decoded = Buffer.from(data.content, "base64").toString("utf8");
      return JSON.parse(decoded);
    }
    return null;
  } catch (e) {
    return null;
  }
}

// Extract the minimum info we need from a submission to aggregate. Never
// returns file content.
function extractMetrics(submission) {
  if (!submission || typeof submission !== "object") return null;
  const events = Array.isArray(submission.events) ? submission.events : [];
  const metrics = {
    role: submission.role,
    session_id: submission.session_id,
    received_at: submission.received_at || submission.consent_ts || null,
    started: false,
    phase_complete: { profile: false, task: false, reflection: false },
    phase_skipped: { profile: false, task: false, reflection: false },
    phase_duration_ms: { profile: 0, task: 0, reflection: 0 },
    submitted: false,
    completed: false,
  };

  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const name = ev.event;
    const phase = ev.phase;
    if (name === "session_start") metrics.started = true;
    else if (name === "phase_complete" && PHASES.includes(phase)) {
      metrics.phase_complete[phase] = true;
      const d = Number(ev.meta?.duration_ms || 0);
      if (d > 0) metrics.phase_duration_ms[phase] = d;
    } else if (name === "phase_skipped" && PHASES.includes(phase)) {
      metrics.phase_skipped[phase] = true;
    } else if (name === "session_submit") metrics.submitted = true;
    else if (name === "session_complete") metrics.completed = true;
  }

  // If there are no events at all (edge case), infer "submitted" from the
  // presence of the file — the server only writes on successful submit.
  if (events.length === 0) {
    metrics.started = true;
    metrics.submitted = true;
  }

  return metrics;
}

function inRange(tsIso, range) {
  if (!tsIso) return true; // if no timestamp, include (legacy edge case)
  const t = Date.parse(tsIso);
  if (Number.isNaN(t)) return true;
  return t >= range.startAt && t <= range.endAt;
}

function isoDay(tsIso) {
  if (!tsIso) return null;
  const d = new Date(tsIso);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Aggregate
// ---------------------------------------------------------------------------

function aggregate(metricsList, range) {
  const agg = emptyResponse("all", "all");
  const phaseTotals = emptyPhaseDurations();
  const byDay = new Map();

  for (const m of metricsList) {
    if (!m) continue;
    if (!inRange(m.received_at, range)) continue;

    agg.total += 1;
    if (m.role && agg.by_role[m.role] != null) agg.by_role[m.role] += 1;

    // Funnel
    if (m.started) agg.funnel.started += 1;
    if (m.phase_complete.profile) agg.funnel.profile_done += 1;
    if (m.phase_complete.task) agg.funnel.task_done += 1;
    if (m.phase_complete.reflection) agg.funnel.reflection_done += 1;
    if (m.submitted) agg.funnel.submitted += 1;

    // Phase durations — only count when phase actually completed
    for (const p of PHASES) {
      if (m.phase_complete[p] && m.phase_duration_ms[p] > 0) {
        phaseTotals[p].sum_ms += m.phase_duration_ms[p];
        phaseTotals[p].count += 1;
      }
    }

    // Timeseries
    const day = isoDay(m.received_at);
    if (day) byDay.set(day, (byDay.get(day) || 0) + 1);
  }

  // Finalize phase durations
  for (const p of PHASES) {
    agg.avg_duration_per_phase[p] =
      phaseTotals[p].count > 0
        ? Math.round(phaseTotals[p].sum_ms / phaseTotals[p].count)
        : 0;
  }

  // Drop-off: candidates who did phase N but not phase N+1
  agg.drop_off.after_profile = Math.max(
    0,
    agg.funnel.profile_done - agg.funnel.task_done
  );
  agg.drop_off.after_task = Math.max(
    0,
    agg.funnel.task_done - agg.funnel.reflection_done
  );
  agg.drop_off.after_reflection = Math.max(
    0,
    agg.funnel.reflection_done - agg.funnel.submitted
  );

  // Sort timeseries ascending
  agg.timeseries = [...byDay.entries()]
    .map(([day, count]) => ({ day, count }))
    .sort((a, b) => (a.day < b.day ? -1 : 1));

  return agg;
}

// ---------------------------------------------------------------------------
// Handler
// ---------------------------------------------------------------------------

export async function handler(event) {
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }
  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "method_not_allowed" }),
    };
  }

  const qp = event.queryStringParameters || {};
  const context = (qp.context || "all").toLowerCase();
  const period = (qp.period || "7d").toLowerCase();

  const validContexts = new Set([
    "all",
    "plugin",
    "site",
    ...ALL_ROLES,
  ]);
  const safeContext = validContexts.has(context) ? context : "all";
  const validPeriods = new Set(["7d", "30d", "all"]);
  const safePeriod = validPeriods.has(period) ? period : "7d";
  const range = buildRange(safePeriod);

  const errors = [];

  // Graceful: no token → empty shape
  if (!GITHUB_TOKEN) {
    const body = emptyResponse(safeContext, safePeriod, [
      { endpoint: "config", reason: "submissions backend not configured" },
    ]);
    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
      body: JSON.stringify(body),
    };
  }

  // Which roles to scan. context=plugin/all/site → all roles; specific role →
  // just that one.
  const rolesToScan = ALL_ROLES.includes(safeContext)
    ? [safeContext]
    : ALL_ROLES;

  // List files per role (parallel)
  const listJobs = rolesToScan.map((role) =>
    settle(`list.${role}`, listRole(role))
  );
  const listResults = await Promise.all(listJobs);

  const allFiles = [];
  for (const r of listResults) {
    if (!r.ok) {
      // 404 on whole repo → graceful empty
      if (r.error?.status === 404) {
        const body = emptyResponse(safeContext, safePeriod, [
          {
            endpoint: r.label,
            reason: "submissions backend not configured",
          },
        ]);
        return {
          statusCode: 200,
          headers: {
            ...CORS_HEADERS,
            "Content-Type": "application/json",
            "Cache-Control": "public, max-age=30",
          },
          body: JSON.stringify(body),
        };
      }
      recordError(errors, r.label, r.error);
      continue;
    }
    const role = r.label.replace(/^list\./, "");
    for (const f of r.value) allFiles.push({ role, file: f });
  }

  // Cap to avoid runaway fetches (Netlify has a 10s default timeout).
  // 200 files * ~10KB each = 2MB, should fit comfortably.
  const MAX_FILES = 200;
  if (allFiles.length > MAX_FILES) {
    // Sort by name desc (session_id is date-prefixed) and take most recent.
    allFiles.sort((a, b) => (a.file.name < b.file.name ? 1 : -1));
    allFiles.length = MAX_FILES;
    errors.push({
      endpoint: "capacity",
      reason: `truncated to most recent ${MAX_FILES} submissions`,
    });
  }

  // Fetch all submissions in parallel
  const fetchJobs = allFiles.map(({ role, file }) =>
    settle(`fetch.${role}.${file.name}`, fetchSubmission(role, file))
  );
  const fetchResults = await Promise.all(fetchJobs);

  const metricsList = [];
  for (const r of fetchResults) {
    if (!r.ok) {
      recordError(errors, r.label, r.error);
      continue;
    }
    const metrics = extractMetrics(r.value);
    if (metrics) metricsList.push(metrics);
  }

  const body = aggregate(metricsList, range);
  body.context = safeContext;
  body.period = safePeriod;
  body.generated_at = new Date().toISOString();
  body.errors = errors;

  return {
    statusCode: 200,
    headers: {
      ...CORS_HEADERS,
      "Content-Type": "application/json",
      "Cache-Control": "public, max-age=30",
    },
    body: JSON.stringify(body),
  };
}
