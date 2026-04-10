// umami-stats.js — Netlify Function proxy for Umami Cloud API
// Fetches analytics server-side so the API key never leaves the server.

const UMAMI_API_BASE = "https://api.umami.is/v1";
const WEBSITE_ID = "7ea4880d-b761-4f50-838a-1eed2dd3f443";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

// Resolve a period string into [startAt, endAt] unix-ms timestamps
function resolvePeriod(period) {
  const now = Date.now();
  const DAY = 24 * 60 * 60 * 1000;
  switch (period) {
    case "24h":
      return { startAt: now - DAY, endAt: now };
    case "7d":
      return { startAt: now - 7 * DAY, endAt: now };
    case "30d":
      return { startAt: now - 30 * DAY, endAt: now };
    case "all":
      return { startAt: now - 365 * DAY, endAt: now };
    default:
      return { startAt: now - DAY, endAt: now };
  }
}

// Small helper to call the Umami API with auth header
async function umamiGet(path, apiKey) {
  const url = `${UMAMI_API_BASE}${path}`;
  const res = await fetch(url, {
    method: "GET",
    headers: {
      "x-umami-api-key": apiKey,
      Accept: "application/json",
    },
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Umami ${path} → ${res.status}: ${text.slice(0, 200)}`);
  }
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`Umami ${path} → invalid JSON: ${e.message}`);
  }
}

// Umami metrics come back as [{x, y}, ...]; normalize to [{label, visits}, ...]
function normalizeMetrics(raw) {
  if (!Array.isArray(raw)) return [];
  return raw.map((item) => ({
    label: item.x ?? "",
    visits: Number(item.y ?? 0),
  }));
}

export async function handler(event) {
  // CORS preflight
  if (event.httpMethod === "OPTIONS") {
    return { statusCode: 200, headers: CORS_HEADERS, body: "" };
  }

  if (event.httpMethod !== "GET") {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: "method_not_allowed" }),
    };
  }

  const apiKey = process.env.UMAMI_API_KEY;
  if (!apiKey) {
    return {
      statusCode: 500,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({ error: "UMAMI_API_KEY not configured" }),
    };
  }

  const period = (event.queryStringParameters?.period || "24h").toLowerCase();
  const { startAt, endAt } = resolvePeriod(period);
  const range = `startAt=${startAt}&endAt=${endAt}`;

  try {
    const [
      stats,
      active,
      pages,
      referrers,
      browsers,
      os,
      devices,
      countries,
      events,
    ] = await Promise.all([
      umamiGet(`/websites/${WEBSITE_ID}/stats?${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/active`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=url&${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=referrer&${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=browser&${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=os&${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=device&${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=country&${range}`, apiKey),
      umamiGet(`/websites/${WEBSITE_ID}/metrics?type=event&${range}`, apiKey),
    ]);

    // Umami /stats returns { pageviews: {value, prev}, visitors: {...}, ... }
    // Flatten to plain numbers for the frontend.
    const flat = (metric) =>
      typeof metric === "object" && metric !== null && "value" in metric
        ? Number(metric.value || 0)
        : Number(metric || 0);

    const pageviews = flat(stats.pageviews);
    const visitors = flat(stats.visitors);
    const visits = flat(stats.visits);
    const bounces = flat(stats.bounces);
    const totaltime = flat(stats.totaltime);

    const bounceRate = visits > 0 ? Math.round((bounces / visits) * 1000) / 10 : 0;
    const avgTimeSeconds = visits > 0 ? Math.round(totaltime / visits) : 0;

    // /active returns { x: N } where N is current active visitors
    const activeNow =
      typeof active === "object" && active !== null
        ? Number(active.x ?? active.visitors ?? 0)
        : 0;

    const body = {
      period,
      generated_at: new Date().toISOString(),
      overall: {
        pageviews,
        visitors,
        visits,
        bounces,
        totaltime,
        bounce_rate: bounceRate,
        avg_time_seconds: avgTimeSeconds,
        active_now: activeNow,
      },
      pages: normalizeMetrics(pages).map((m) => ({ page: m.label, visits: m.visits })),
      referrers: normalizeMetrics(referrers),
      browsers: normalizeMetrics(browsers),
      os: normalizeMetrics(os),
      devices: normalizeMetrics(devices),
      countries: normalizeMetrics(countries),
      events: normalizeMetrics(events),
    };

    return {
      statusCode: 200,
      headers: {
        ...CORS_HEADERS,
        "Content-Type": "application/json",
        "Cache-Control": "public, max-age=30",
      },
      body: JSON.stringify(body),
    };
  } catch (error) {
    console.error("umami-stats error:", error);
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "upstream_failed",
        details: String(error.message || error),
      }),
    };
  }
}
