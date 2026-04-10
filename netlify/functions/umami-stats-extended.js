// umami-stats-extended.js — Netlify Function proxy for Umami Cloud API
// Extended version of umami-stats.js with:
//   - Comparison period (same length, immediately prior)
//   - Time-series (pageviews/visitors per hour or per day)
//   - All metric dimensions (url, referrer, browser, os, device, country, event)
//   - Event details (best-effort via event-data/events and event-data/stats)
//   - Funnel derived from events
// Uses Promise.allSettled for graceful degradation — returns what works,
// logs warnings for the rest, fails the whole request only if overall.current fails.

const UMAMI_API_BASE = "https://api.umami.is/v1";
const WEBSITE_ID = "7ea4880d-b761-4f50-838a-1eed2dd3f443";

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
};

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

// Build current + previous range (ms) for a given period string.
// Previous is the same length, ending exactly at current.startAt.
function buildRange(period) {
  const endAt = Date.now();
  let length;
  switch (period) {
    case "24h":
      length = DAY;
      break;
    case "7d":
      length = 7 * DAY;
      break;
    case "30d":
      length = 30 * DAY;
      break;
    case "90d":
      length = 90 * DAY;
      break;
    case "all":
      length = 365 * DAY;
      break;
    default:
      length = 7 * DAY;
  }
  const startAt = endAt - length;
  return {
    current: { startAt, endAt },
    previous: { startAt: startAt - length, endAt: startAt },
    length,
  };
}

// Decide time-series granularity: hour for 24h, day for everything else.
function pickUnit(period) {
  return period === "24h" ? "hour" : "day";
}

// GET wrapper for Umami API. Throws on non-2xx.
async function fetchUmami(path, apiKey) {
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
    const err = new Error(`${res.status} ${res.statusText}: ${text.slice(0, 200)}`);
    err.status = res.status;
    err.path = path;
    throw err;
  }
  try {
    return await res.json();
  } catch (e) {
    const err = new Error(`invalid JSON: ${e.message}`);
    err.path = path;
    throw err;
  }
}

// Flatten Umami /stats response: {pageviews: {value, prev}, ...} → plain numbers.
function flattenStats(stats) {
  if (!stats || typeof stats !== "object") {
    return {
      pageviews: 0,
      visitors: 0,
      visits: 0,
      bounces: 0,
      totaltime: 0,
    };
  }
  const num = (m) =>
    typeof m === "object" && m !== null && "value" in m
      ? Number(m.value || 0)
      : Number(m || 0);
  return {
    pageviews: num(stats.pageviews),
    visitors: num(stats.visitors),
    visits: num(stats.visits),
    bounces: num(stats.bounces),
    totaltime: num(stats.totaltime),
  };
}

// Enrich flat stats with derived fields (bounce_rate, avg_time_seconds).
function enrichStats(flat) {
  const { pageviews, visitors, visits, bounces, totaltime } = flat;
  const bounce_rate =
    visits > 0 ? Math.round((bounces / visits) * 1000) / 10 : 0;
  const avg_time_seconds = visits > 0 ? Math.round(totaltime / visits) : 0;
  return {
    pageviews,
    visitors,
    visits,
    bounces,
    totaltime,
    bounce_rate,
    avg_time_seconds,
  };
}

// Percentage delta with 1-decimal rounding. Returns null if prev is 0.
function computeDelta(current, previous) {
  if (previous === 0 || previous == null) return null;
  return Math.round(((current - previous) / previous) * 1000) / 10;
}

// Normalize Umami metrics array ([{x, y}, ...]) and compute share.
function normalizeMetrics(raw) {
  if (!Array.isArray(raw)) return [];
  const total = raw.reduce((sum, item) => sum + Number(item.y ?? 0), 0);
  return raw.map((item) => {
    const visits = Number(item.y ?? 0);
    return {
      label: String(item.x ?? ""),
      visits,
      share: total > 0 ? Math.round((visits / total) * 10000) / 10000 : 0,
    };
  });
}

// Normalize pageviews time-series: {pageviews: [{x, y}], sessions: [{x, y}]}
// → { pageviews: [{t, v}], visitors: [{t, v}] }.
// Umami returns `x` as a timestamp string ("2026-04-10 14:00:00") — pass through
// converted to ISO.
function normalizeTimeseries(raw) {
  const toPoint = (entry) => {
    const rawT = entry?.x;
    let iso;
    if (rawT == null) {
      iso = null;
    } else if (typeof rawT === "number") {
      iso = new Date(rawT).toISOString();
    } else {
      // "2026-04-10 14:00:00" → treat as UTC
      const s = String(rawT).replace(" ", "T");
      const d = new Date(s.endsWith("Z") ? s : `${s}Z`);
      iso = Number.isNaN(d.getTime()) ? String(rawT) : d.toISOString();
    }
    return { t: iso, v: Number(entry?.y ?? 0) };
  };
  const pageviews = Array.isArray(raw?.pageviews) ? raw.pageviews.map(toPoint) : [];
  const visitors = Array.isArray(raw?.sessions) ? raw.sessions.map(toPoint) : [];
  return { pageviews, visitors };
}

// Settle helper: returns {ok, value, error} for a labelled promise.
async function settle(label, promise) {
  try {
    const value = await promise;
    return { label, ok: true, value };
  } catch (error) {
    return { label, ok: false, error };
  }
}

// Push an error record into the errors array and console.warn it.
function recordError(errors, endpoint, err) {
  const reason =
    err?.status != null
      ? `${err.status} ${String(err.message || "").slice(0, 160)}`
      : String(err?.message || err || "unknown");
  console.warn(`umami-stats-extended: ${endpoint} failed → ${reason}`);
  errors.push({ endpoint, reason });
}

// Build a funnel from event metrics + overall visits.
// Step 0 is "visit" (total visits for period), followed by events in descending count order.
function buildFunnel(totalVisits, eventMetrics) {
  const steps = [];
  const firstCount = totalVisits || 0;
  steps.push({
    name: "visit",
    count: firstCount,
    pct_of_first: firstCount > 0 ? 1 : 0,
  });

  // Sort events by visits desc. Take top 5 so the funnel stays readable.
  const sorted = [...eventMetrics].sort((a, b) => b.visits - a.visits).slice(0, 5);

  let prevCount = firstCount;
  for (const ev of sorted) {
    const count = ev.visits;
    const pct_of_first =
      firstCount > 0 ? Math.round((count / firstCount) * 10000) / 10000 : 0;
    const pct_of_prev =
      prevCount > 0 ? Math.round((count / prevCount) * 10000) / 10000 : 0;
    steps.push({ name: ev.label, count, pct_of_first, pct_of_prev });
    prevCount = count;
  }

  // Conversion rate = top event / visits (or 0 if no events).
  const conversion_rate =
    sorted.length > 0 && firstCount > 0
      ? Math.round((sorted[0].visits / firstCount) * 10000) / 10000
      : 0;

  return { steps, conversion_rate };
}

// Aggregate event-data/events raw response into { total, by_name: { name: { count, by_role } } }.
// event-data/events returns an array of event instances with optional eventProperties.
// Shape on Umami Cloud is best-effort — we try a few known keys.
function aggregateEventDetails(rawEvents, eventMetrics) {
  const byName = {};

  // Seed from metrics so events without detailed rows still appear.
  for (const m of eventMetrics) {
    if (!m.label) continue;
    byName[m.label] = { count: m.visits, by_role: {} };
  }

  if (Array.isArray(rawEvents)) {
    for (const row of rawEvents) {
      const name =
        row?.eventName ||
        row?.event_name ||
        row?.name ||
        row?.urlPath ||
        "unknown";
      if (!byName[name]) byName[name] = { count: 0, by_role: {} };
      // Only increment if we got raw instances (not just metadata).
      // If the row looks like an instance (has createdAt or sessionId), count it.
      if (row?.createdAt || row?.created_at || row?.sessionId || row?.session_id) {
        byName[name].count += 1;
      }
      // Try to pull a `role` property out of common shapes.
      const props =
        row?.eventData ||
        row?.event_data ||
        row?.properties ||
        row?.data ||
        null;
      const role =
        (props && (props.role || props.Role)) ||
        row?.role ||
        null;
      if (role) {
        const key = String(role);
        byName[name].by_role[key] = (byName[name].by_role[key] || 0) + 1;
      }
    }
  }

  const total = Object.values(byName).reduce((sum, e) => sum + (e.count || 0), 0);
  return { total, by_name: byName };
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

  const period = (event.queryStringParameters?.period || "7d").toLowerCase();
  const validPeriods = new Set(["24h", "7d", "30d", "90d", "all"]);
  const safePeriod = validPeriods.has(period) ? period : "7d";
  const { current, previous } = buildRange(safePeriod);
  const unit = pickUnit(safePeriod);

  const rangeQS = (r) => `startAt=${r.startAt}&endAt=${r.endAt}`;
  const curQS = rangeQS(current);
  const prevQS = rangeQS(previous);

  const errors = [];

  // -------------------------------------------------------------------------
  // Fire all requests in parallel via Promise.allSettled
  // -------------------------------------------------------------------------
  const jobs = [
    // Current period
    settle("stats.current", fetchUmami(`/websites/${WEBSITE_ID}/stats?${curQS}`, apiKey)),
    settle(
      "pageviews.current",
      fetchUmami(`/websites/${WEBSITE_ID}/pageviews?${curQS}&unit=${unit}&timezone=UTC`, apiKey)
    ),
    settle("pages", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=url&${curQS}`, apiKey)),
    settle("referrers", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=referrer&${curQS}`, apiKey)),
    settle("browsers", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=browser&${curQS}`, apiKey)),
    settle("os", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=os&${curQS}`, apiKey)),
    settle("devices", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=device&${curQS}`, apiKey)),
    settle("countries", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=country&${curQS}`, apiKey)),
    settle("eventMetrics", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=event&${curQS}`, apiKey)),
    settle("active", fetchUmami(`/websites/${WEBSITE_ID}/active`, apiKey)),

    // Previous period
    settle("stats.previous", fetchUmami(`/websites/${WEBSITE_ID}/stats?${prevQS}`, apiKey)),

    // Event details — may 404 on Umami Cloud
    settle(
      "event-data.events",
      fetchUmami(`/websites/${WEBSITE_ID}/event-data/events?${curQS}`, apiKey)
    ),
    settle(
      "event-data.stats",
      fetchUmami(`/websites/${WEBSITE_ID}/event-data/stats?${curQS}`, apiKey)
    ),
  ];

  const results = await Promise.all(jobs);
  const byLabel = Object.fromEntries(results.map((r) => [r.label, r]));

  const need = (label) => {
    const r = byLabel[label];
    if (!r) return null;
    if (!r.ok) {
      recordError(errors, label, r.error);
      return null;
    }
    return r.value;
  };

  // -------------------------------------------------------------------------
  // Overall (current is MANDATORY — fail whole request if missing)
  // -------------------------------------------------------------------------
  const statsCurRaw = need("stats.current");
  if (!statsCurRaw) {
    const mainErr = byLabel["stats.current"]?.error;
    return {
      statusCode: 502,
      headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
      body: JSON.stringify({
        error: "upstream_failed",
        details: String(mainErr?.message || mainErr || "stats.current missing"),
      }),
    };
  }

  const curFlat = enrichStats(flattenStats(statsCurRaw));

  const statsPrevRaw = need("stats.previous");
  const prevFlat = statsPrevRaw ? enrichStats(flattenStats(statsPrevRaw)) : null;

  // Active now
  const activeRaw = need("active");
  const activeNow =
    activeRaw && typeof activeRaw === "object"
      ? Number(activeRaw.x ?? activeRaw.visitors ?? 0)
      : 0;

  const overall = {
    current: { ...curFlat, active_now: activeNow },
    previous: prevFlat,
    delta_pct: prevFlat
      ? {
          pageviews: computeDelta(curFlat.pageviews, prevFlat.pageviews),
          visitors: computeDelta(curFlat.visitors, prevFlat.visitors),
          visits: computeDelta(curFlat.visits, prevFlat.visits),
          bounce_rate: computeDelta(curFlat.bounce_rate, prevFlat.bounce_rate),
          avg_time_seconds: computeDelta(
            curFlat.avg_time_seconds,
            prevFlat.avg_time_seconds
          ),
        }
      : null,
  };

  // -------------------------------------------------------------------------
  // Time-series
  // -------------------------------------------------------------------------
  const pvRaw = need("pageviews.current");
  const timeseries = pvRaw ? normalizeTimeseries(pvRaw) : { pageviews: [], visitors: [] };

  // -------------------------------------------------------------------------
  // Metric dimensions
  // -------------------------------------------------------------------------
  const pages = normalizeMetrics(need("pages"));
  const referrers = normalizeMetrics(need("referrers"));
  const browsers = normalizeMetrics(need("browsers"));
  const os = normalizeMetrics(need("os"));
  const devices = normalizeMetrics(need("devices"));
  const countries = normalizeMetrics(need("countries"));
  const eventMetrics = normalizeMetrics(need("eventMetrics"));

  // -------------------------------------------------------------------------
  // Event details (best-effort)
  // -------------------------------------------------------------------------
  const rawEventInstances = need("event-data.events");
  const events = aggregateEventDetails(rawEventInstances, eventMetrics);

  // event-data.stats is fetched for completeness — if it returned, merge total.
  const evStats = need("event-data.stats");
  if (evStats && typeof evStats === "object") {
    // Not all Umami deploys return the same shape; only override total if we
    // get a clear scalar.
    if (typeof evStats.events === "number") events.total = evStats.events;
    else if (typeof evStats.total === "number") events.total = evStats.total;
  }

  // -------------------------------------------------------------------------
  // Funnel
  // -------------------------------------------------------------------------
  const funnel = buildFunnel(curFlat.visits, eventMetrics);

  // -------------------------------------------------------------------------
  // Response
  // -------------------------------------------------------------------------
  const body = {
    period: safePeriod,
    generated_at: new Date().toISOString(),
    range: { current, previous },
    overall,
    timeseries,
    pages,
    referrers,
    browsers,
    os,
    devices,
    countries,
    events,
    funnel,
    errors,
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
}
