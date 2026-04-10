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

// Decide time-series granularity based on range length.
// <= 1 day → hour; > 1 day → day (Umami downgrades hour→day past 30d anyway).
function pickUnit(lengthMs) {
  return lengthMs <= DAY ? "hour" : "day";
}

// ISO country code → full name. Keep small and hand-curated; unknowns fall back to the code.
const COUNTRY_NAMES = {
  PT: "Portugal", US: "United States", GB: "United Kingdom", DE: "Germany",
  FR: "France", ES: "Spain", IT: "Italy", NL: "Netherlands", RU: "Russia",
  UA: "Ukraine", PL: "Poland", BY: "Belarus", KZ: "Kazakhstan", LT: "Lithuania",
  LV: "Latvia", EE: "Estonia", FI: "Finland", SE: "Sweden", NO: "Norway",
  DK: "Denmark", IE: "Ireland", BE: "Belgium", CH: "Switzerland", AT: "Austria",
  CZ: "Czechia", SK: "Slovakia", HU: "Hungary", RO: "Romania", BG: "Bulgaria",
  GR: "Greece", TR: "Turkey", IL: "Israel", AE: "UAE", SA: "Saudi Arabia",
  IN: "India", CN: "China", JP: "Japan", KR: "South Korea", SG: "Singapore",
  HK: "Hong Kong", TW: "Taiwan", TH: "Thailand", VN: "Vietnam", ID: "Indonesia",
  MY: "Malaysia", PH: "Philippines", AU: "Australia", NZ: "New Zealand",
  CA: "Canada", MX: "Mexico", BR: "Brazil", AR: "Argentina", CL: "Chile",
  CO: "Colombia", ZA: "South Africa", EG: "Egypt", NG: "Nigeria", KE: "Kenya",
  MA: "Morocco", GE: "Georgia", AM: "Armenia", AZ: "Azerbaijan", MD: "Moldova",
  RS: "Serbia", HR: "Croatia", SI: "Slovenia", IS: "Iceland", LU: "Luxembourg",
  MT: "Malta", CY: "Cyprus",
};

// ISO 3166-1 alpha-2 → regional indicator symbols (flag emoji).
function isoToFlag(iso) {
  if (typeof iso !== "string" || iso.length !== 2) return "";
  const upper = iso.toUpperCase();
  if (!/^[A-Z]{2}$/.test(upper)) return "";
  return String.fromCodePoint(
    ...[...upper].map((c) => 0x1f1e6 - 65 + c.charCodeAt(0))
  );
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

// Parse Umami bucket timestamp into ms since epoch (UTC).
function parseBucketTs(rawT) {
  if (rawT == null) return null;
  if (typeof rawT === "number") return rawT;
  const s = String(rawT).replace(" ", "T");
  const d = new Date(s.endsWith("Z") ? s : `${s}Z`);
  return Number.isNaN(d.getTime()) ? null : d.getTime();
}

// Round a timestamp down to the bucket boundary.
function bucketStart(ts, unit) {
  const d = new Date(ts);
  if (unit === "hour") {
    d.setUTCMinutes(0, 0, 0);
  } else {
    d.setUTCHours(0, 0, 0, 0);
  }
  return d.getTime();
}

function bucketNext(ts, unit) {
  return ts + (unit === "hour" ? HOUR : DAY);
}

// Normalize pageviews time-series: {pageviews: [{x, y}], sessions: [{x, y}]}
// → { pageviews: [{t, v}], visitors: [{t, v}] }. Fills gaps with zeros so the
// client gets a continuous series across the entire requested range.
function normalizeTimeseries(raw, range, unit) {
  const indexSeries = (arr) => {
    const idx = new Map();
    if (!Array.isArray(arr)) return idx;
    for (const entry of arr) {
      const ts = parseBucketTs(entry?.x);
      if (ts == null) continue;
      idx.set(bucketStart(ts, unit), Number(entry?.y ?? 0));
    }
    return idx;
  };
  const pvIdx = indexSeries(raw?.pageviews);
  const vIdx = indexSeries(raw?.sessions);

  const pageviews = [];
  const visitors = [];
  if (!range) return { pageviews, visitors };

  const start = bucketStart(range.startAt, unit);
  const endBoundary = bucketStart(range.endAt, unit);
  for (let t = start; t <= endBoundary; t = bucketNext(t, unit)) {
    const iso = new Date(t).toISOString();
    pageviews.push({ t: iso, v: pvIdx.get(t) ?? 0 });
    visitors.push({ t: iso, v: vIdx.get(t) ?? 0 });
  }
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

// Aggregate event details into { total, by_name: { [name]: { count, properties: { [key]: { [value]: count } } } } }.
//
// Real Umami Cloud shape:
//   GET /event-data/events  → [{eventName, propertyName, dataType, total}, ...]
//     (one row per (event × property) with total occurrences of that property in the range)
//   GET /event-data/values?eventName=X&propertyName=Y → [{value, total}, ...]
//     (distribution of actual values for a given event+property)
//
// So we first build the (event, property) skeleton from /events, then fetch
// /values for each (event, property) pair in parallel to get the value breakdown.
async function aggregateEventDetails(rawEvents, eventMetrics, range, apiKey) {
  const byName = {};

  // Seed from metrics so events without property rows still appear.
  for (const m of eventMetrics) {
    if (!m.label) continue;
    byName[m.label] = { count: m.visits, properties: {} };
  }

  // Discover (event, property) pairs from /event-data/events.
  const pairs = [];
  if (Array.isArray(rawEvents)) {
    for (const row of rawEvents) {
      const name = row?.eventName || row?.event_name || row?.name;
      const prop = row?.propertyName || row?.property_name;
      if (!name || !prop) continue;
      if (!byName[name]) byName[name] = { count: 0, properties: {} };
      if (!byName[name].properties[prop]) byName[name].properties[prop] = {};
      pairs.push({ eventName: name, propertyName: prop });
    }
  }

  // Fetch value distributions in parallel. Each failure is swallowed — we still
  // have the property key, just without value breakdown.
  const qs = `startAt=${range.startAt}&endAt=${range.endAt}`;
  await Promise.all(
    pairs.map(async ({ eventName, propertyName }) => {
      try {
        const path =
          `/websites/${WEBSITE_ID}/event-data/values?${qs}` +
          `&eventName=${encodeURIComponent(eventName)}` +
          `&propertyName=${encodeURIComponent(propertyName)}`;
        const values = await fetchUmami(path, apiKey);
        if (!Array.isArray(values)) return;
        const bucket = byName[eventName].properties[propertyName];
        for (const v of values) {
          const key = String(v?.value ?? "");
          if (!key) continue;
          bucket[key] = (bucket[key] || 0) + Number(v?.total ?? 0);
        }
      } catch (e) {
        // Silent — already have property key, just no value breakdown.
      }
    })
  );

  const total = Object.values(byName).reduce((sum, e) => sum + (e.count || 0), 0);
  return { total, by_name: byName };
}

// Trend classifier for dynamics block.
function trendOf(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  if (c > p) return "up";
  if (c < p) return "down";
  return "flat";
}

// Build dynamics entry: {current, previous, delta_abs, delta_pct, trend}.
function dynamicsEntry(current, previous) {
  const c = Number(current) || 0;
  const p = Number(previous) || 0;
  return {
    current: c,
    previous: p,
    delta_abs: Math.round((c - p) * 10) / 10,
    delta_pct: computeDelta(c, p),
    trend: trendOf(c, p),
  };
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
  const { current, previous, length } = buildRange(safePeriod);
  const unit = pickUnit(length);

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
    settle("cities", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=city&${curQS}`, apiKey)),
    settle("regions", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=region&${curQS}`, apiKey)),
    settle("eventMetrics", fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=event&${curQS}`, apiKey)),
    settle("active", fetchUmami(`/websites/${WEBSITE_ID}/active`, apiKey)),

    // Previous period
    settle("stats.previous", fetchUmami(`/websites/${WEBSITE_ID}/stats?${prevQS}`, apiKey)),
    settle(
      "eventMetrics.previous",
      fetchUmami(`/websites/${WEBSITE_ID}/metrics?type=event&${prevQS}`, apiKey)
    ),

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
  const timeseries = normalizeTimeseries(pvRaw, current, unit);

  // -------------------------------------------------------------------------
  // Metric dimensions
  // -------------------------------------------------------------------------
  const pages = normalizeMetrics(need("pages"));
  const referrers = normalizeMetrics(need("referrers"));
  const browsers = normalizeMetrics(need("browsers"));
  const os = normalizeMetrics(need("os"));
  const devices = normalizeMetrics(need("devices"));
  const countries = normalizeMetrics(need("countries"));
  const cities = normalizeMetrics(need("cities"));
  const regions = normalizeMetrics(need("regions"));
  const eventMetrics = normalizeMetrics(need("eventMetrics"));
  const eventMetricsPrev = normalizeMetrics(need("eventMetrics.previous"));

  // -------------------------------------------------------------------------
  // Geo with ISO flag + country name enrichment
  // -------------------------------------------------------------------------
  const countriesEnriched = countries.map((c) => ({
    ...c,
    name: COUNTRY_NAMES[c.label] || c.label,
    flag: isoToFlag(c.label),
  }));
  const geo = {
    countries: countriesEnriched,
    cities,
    regions,
  };

  // -------------------------------------------------------------------------
  // Event details (best-effort)
  // -------------------------------------------------------------------------
  const rawEventAggregates = need("event-data.events");
  const events = await aggregateEventDetails(
    rawEventAggregates,
    eventMetrics,
    current,
    apiKey
  );

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
  // Dynamics — key metrics current vs previous with trend classification
  // -------------------------------------------------------------------------
  const findEventCount = (metrics, name) => {
    const m = metrics.find((e) => e.label === name);
    return m ? m.visits : 0;
  };
  const applyClicksCur = findEventCount(eventMetrics, "apply-click");
  const applyClicksPrev = findEventCount(eventMetricsPrev, "apply-click");

  const conversionRate = (clicks, visits) =>
    visits > 0 ? Math.round((clicks / visits) * 1000) / 10 : 0;

  const convCur = conversionRate(applyClicksCur, curFlat.visits);
  const convPrev = prevFlat ? conversionRate(applyClicksPrev, prevFlat.visits) : 0;

  const dynamics = {
    pageviews: dynamicsEntry(curFlat.pageviews, prevFlat?.pageviews ?? 0),
    visitors: dynamicsEntry(curFlat.visitors, prevFlat?.visitors ?? 0),
    apply_clicks: dynamicsEntry(applyClicksCur, applyClicksPrev),
    conversion_rate: dynamicsEntry(convCur, convPrev),
  };

  // -------------------------------------------------------------------------
  // Response
  // -------------------------------------------------------------------------
  const body = {
    period: safePeriod,
    generated_at: new Date().toISOString(),
    range: { current, previous },
    overall,
    dynamics,
    timeseries,
    pages,
    referrers,
    browsers,
    os,
    devices,
    countries: countriesEnriched,
    geo,
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
