// submit.js — Netlify Function to receive assessment submissions
// Commits candidate data to private GitHub repo via GitHub API

const GITHUB_TOKEN = process.env.GITHUB_SUBMISSIONS_TOKEN;
const SUBMISSIONS_REPO = "ai-mindset-org/aim-apply-submissions";

export async function handler(event) {
  // CORS
  if (event.httpMethod === "OPTIONS") {
    return {
      statusCode: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type",
      },
    };
  }

  if (event.httpMethod !== "POST") {
    return { statusCode: 405, body: "Method not allowed" };
  }

  if (!GITHUB_TOKEN) {
    console.error("GITHUB_SUBMISSIONS_TOKEN not set");
    return { statusCode: 500, body: JSON.stringify({ error: "server misconfigured" }) };
  }

  let payload;
  try {
    payload = JSON.parse(event.body);
  } catch (e) {
    return { statusCode: 400, body: JSON.stringify({ error: "invalid JSON" }) };
  }

  const { candidate = "unknown", direction = "unknown", date, scores, files, tracking } = payload;

  // Sanitize candidate name for folder
  const safeName = candidate
    .toLowerCase()
    .replace(/[^a-zа-яё0-9\s-]/gi, "")
    .replace(/\s+/g, "-")
    .substring(0, 50);

  const folderPath = `${date}-${safeName}`;

  try {
    // Create files in the private repo via GitHub API
    const filesToCommit = [];

    // scores.json
    if (scores) {
      filesToCommit.push({
        path: `${folderPath}/scores.json`,
        content: JSON.stringify(scores, null, 2),
      });
    }

    // Output files
    if (files) {
      for (const [filename, content] of Object.entries(files)) {
        filesToCommit.push({
          path: `${folderPath}/outputs/${filename}`,
          content: typeof content === "string" ? content : JSON.stringify(content),
        });
      }
    }

    // Tracking data
    if (tracking) {
      if (tracking.session) {
        filesToCommit.push({
          path: `${folderPath}/tracking/session.jsonl`,
          content: typeof tracking.session === "string" ? tracking.session : JSON.stringify(tracking.session),
        });
      }
      if (tracking.profile) {
        filesToCommit.push({
          path: `${folderPath}/tracking/profile.json`,
          content: JSON.stringify(tracking.profile, null, 2),
        });
      }
    }

    // Commit all files using GitHub API (create or update)
    for (const file of filesToCommit) {
      const apiUrl = `https://api.github.com/repos/${SUBMISSIONS_REPO}/contents/${file.path}`;
      const response = await fetch(apiUrl, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${GITHUB_TOKEN}`,
          "Content-Type": "application/json",
          Accept: "application/vnd.github.v3+json",
        },
        body: JSON.stringify({
          message: `Apply: ${candidate} – ${direction}`,
          content: Buffer.from(file.content).toString("base64"),
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error(`Failed to create ${file.path}: ${error}`);
      }
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        success: true,
        message: "submitted",
        folder: folderPath,
      }),
    };
  } catch (error) {
    console.error("Submission error:", error);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "submission failed" }),
    };
  }
}
