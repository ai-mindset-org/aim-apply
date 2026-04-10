# Hiring Funnel Analytics — Architecture

**Scope:** `analytics.html` on `aim-apply` (currently surfaces `jd-marketing.html`).
**Data source:** Umami Cloud API (`https://api.umami.is/v1`).
**Website ID:** `7ea4880d-b761-4f50-838a-1eed2dd3f443`.
**Backend:** `netlify/functions/umami-stats.js` (single batch endpoint proxy).
**Goal:** Make the page materially better than logging into Umami directly — by framing pageviews as a **hiring funnel** and making every number answer one question: *"Are qualified candidates applying, and if not, where do they drop off?"*

---

## 1. Metric catalog

Twenty-three metrics, grouped by funnel stage. Each entry lists the **definition**, the **Umami endpoint** that powers it, and any computation on top. Metrics marked `IMPOSSIBLE` cannot be derived from Umami alone and are documented in §7.

### 1.1 Acquisition (top of funnel)

| # | Metric | Definition | Source |
|---|---|---|---|
| 1 | **Visitors** | Unique sessions in the period (Umami calls these `visitors`). | `GET /websites/{id}/stats` → `visitors.value` |
| 2 | **Pageviews** | Total page events. | `GET /websites/{id}/stats` → `pageviews.value` |
| 3 | **Visits** | Unique visits (sessions bounded by hourly salt rotation). | `GET /websites/{id}/stats` → `visits.value` |
| 4 | **Active now** | Unique visitors in the last 5 minutes. | `GET /websites/{id}/active` → `visitors` |
| 5 | **Traffic by referrer** | Top sources of traffic. | `GET /websites/{id}/metrics?type=referrer` |
| 6 | **Channel mix** | Direct / organic / social / referral grouping (Umami exposes `channel` as a metric type). | `GET /websites/{id}/metrics?type=channel` |
| 7 | **UTM breakdown** | Breakdown by `utm_source` / `utm_medium` / `utm_campaign`. | `GET /websites/{id}/metrics?type=query` (parse) **or** use `filters.query` |
| 8 | **Landing page mix** | Which role landing receives what share of traffic (relevant when >1 JD exists). | `GET /websites/{id}/metrics?type=path` |

### 1.2 Engagement (middle of funnel)

| # | Metric | Definition | Source |
|---|---|---|---|
| 9 | **Bounce rate** | Share of visits with exactly one event (single pageview, no interaction). | `/stats` → `bounces.value / visits.value` |
| 10 | **Average time on page** | Total time on site / visits (ms). Only counted for multi-page visits per Umami's own definition. | `/stats` → `totaltime.value / visits.value` |
| 11 | **Avg events per visit** | Custom event density — signals how many candidates interact beyond scrolling. | `events_total / visits` where `events_total` comes from `/events/stats` |
| 12 | **Device mix** | Desktop / mobile / tablet split. | `/metrics?type=device` |
| 13 | **Browser & OS mix** | Diagnostic for tech-savvy cohort assumption. | `/metrics?type=browser`, `/metrics?type=os` |
| 14 | **Geographic distribution** | Country / region / city breakdown. | `/metrics?type=country`, `type=region`, `type=city` |
| 15 | **Language mix** | `navigator.language` split — useful because AIM operates in RU + EN. | `/metrics?type=language` |
| 16 | **Scroll depth** | `IMPOSSIBLE` out of the box — Umami has no built-in scroll tracking. **Workaround:** emit custom events `scroll-25`, `scroll-50`, `scroll-75`, `scroll-100` from the page and read them via `/metrics?type=event`. |
| 17 | **Section visibility** | Same workaround — emit `section-view` events with `section` property (hero, expectations, tasks, apply). |

### 1.3 Intent → Conversion (bottom of funnel)

| # | Metric | Definition | Source |
|---|---|---|---|
| 18 | **Apply-click rate** | `apply-click` events / visitors. The single most important landing metric. | `/metrics?type=event` filtered to `apply-click` ÷ `/stats.visitors` |
| 19 | **Template-copy rate** | `template-copy` events / visitors. Proxy for serious candidates. | same pattern with `template-copy` |
| 20 | **Apply-click by role** | Breakdown by the role metadata attached to the event. | `/event-data/values?event=apply-click&property=role` (2026-03-02 endpoint) |
| 21 | **Time-to-apply** | Median delta between first pageview and `apply-click` within a session. | `GET /websites/{id}/sessions/{sessionId}/activity` — compute client-side from activity log |
| 22 | **Funnel conversion** | visitors → scroll-50 → apply-click → template-copy, with drop-off at each step. | composed from steps above (§2) |
| 23 | **Submissions** | `IMPOSSIBLE` from Umami — submissions happen in the Telegram bot `@ai_mind_set_team`. Must be pulled from Telegram Bot API or manually annotated. Surface as a **manual input field** on the dashboard. |

### 1.4 Derived / diagnostic

| # | Metric | Definition | Source |
|---|---|---|---|
| 24 | **Data coverage window** | Earliest and latest recorded event — tells the viewer whether "all time" really means 7 days of data. | `GET /websites/{id}/daterange` (added 2026-03-11) |

---

## 2. Funnel model

A hiring landing page is **not** a SaaS checkout. The funnel is shallow (usually two to four meaningful steps) and the true conversion (a Telegram application) is off-platform. That makes **qualifying micro-conversions** the whole game.

### 2.1 Canonical funnel (five steps)

```
Step 1 — Visit                 GET /stats.visitors
Step 2 — Engaged visit         visits − bounces (i.e. ≥2 events)
Step 3 — Scrolled past fold    custom event `scroll-50`
Step 4 — Clicked apply         custom event `apply-click`
Step 5 — Copied template       custom event `template-copy`
```

**Step 6 — Submitted to bot** is shown as a dotted/greyed box on the funnel chart, explicitly labelled "off-platform, enter manually". This keeps the viewer honest about the last-mile gap instead of pretending visit → click is the whole story.

### 2.2 How to compute conversion between steps

Amplitude and Mixpanel compute conversion as `(users who reached step N) ÷ (users who reached step N−1)` within a defined **conversion window**. Umami cannot join events into sessions via the aggregate API, so we approximate:

- **Same-period cohort approximation:** for the selected period, fetch total counts for each step and compute step-over-step ratios. This is what Umami's own UI does. It under-counts true funnel rates (because not everyone who clicked apply also had a recorded scroll-50 in the same session), so label the dashboard accordingly: **"Step ratios — aggregate, not session-joined."**
- **Session-joined (precise) funnel:** only possible by pulling `GET /websites/{id}/sessions` + `GET /websites/{id}/sessions/{sessionId}/activity` for every session and replaying events. This is **expensive** (N+1 calls) and only worth doing for small traffic volumes (<1k sessions/period). For a fresh JD landing with tens of daily visitors this is actually tractable.

**Recommendation:** ship the aggregate version first, add an opt-in "Precise funnel" toggle that triggers the session-join path with a loading spinner.

### 2.3 Role breakdown

Because `apply-click` carries a `role` property, build a **per-role funnel** by filtering the event at step 4 and 5:

```
/event-data/values?event=apply-click&property=role
```

Show each role as a row in a small funnel table with visitors → apply-click → template-copy counts.

---

## 3. Recommended API endpoints

All endpoints are `GET` and live under `https://api.umami.is/v1`. Auth header: `x-umami-api-key: ${UMAMI_API_KEY}`.

### 3.1 Core — already used in `umami-stats.js`

| Endpoint | Returns | Notes |
|---|---|---|
| `/websites/{id}/stats?startAt&endAt&filters...` | `{pageviews, visitors, visits, bounces, totaltime, comparison}` | Supports `compare=prev\|yoy`. Comparison object ships automatically. |
| `/websites/{id}/active` | `{visitors}` (last 5 minutes) | No period; realtime only. |
| `/websites/{id}/metrics?type=X` | `[{x, y}, ...]` | Types: `path`, `entry`, `exit`, `title`, `query`, `referrer`, `channel`, `domain`, `country`, `region`, `city`, `browser`, `os`, `device`, `language`, `screen`, `event`, `hostname`, `tag`, `distinctId`. |

### 3.2 Add to the batch

| Endpoint | Returns | Why |
|---|---|---|
| `/websites/{id}/pageviews?startAt&endAt&unit&timezone&compare` | `{pageviews: [{x,y}], sessions: [{x,y}]}` | Powers the time-series chart. `unit` auto-downgrades (see gotcha in §7). Supports `compare=prev\|yoy` — response will include paired prev-period series. |
| `/websites/{id}/events/series?startAt&endAt&unit&timezone&filters` | `[{x: eventName, t: timestamp, y: count}]` | Time series broken down by event name — drives the "apply-click over time" chart. |
| `/websites/{id}/events/stats?startAt&endAt&compare` | `{data: {events, visitors, visits, uniqueEvents, comparison}}` | One-shot summary of event volume with prev-period delta. Added 2026-03-11. |
| `/websites/{id}/event-data/events?startAt&endAt` | `[{eventName, propertyName, dataType, total}]` | Lists every custom property attached to events — discovery tool for "what properties does `apply-click` carry?" |
| `/websites/{id}/event-data/values?startAt&endAt&event=apply-click&property=role` | `[{value, total}]` | **Per-role apply-click counts.** This is the killer endpoint for the role breakdown. |
| `/websites/{id}/metrics?type=event&startAt&endAt` | `[{x: eventName, y: count}]` | Event leaderboard — already in `umami-stats.js`. Keep. |
| `/websites/{id}/sessions?startAt&endAt&page&pageSize` | `{data: [{id, browser, os, device, country, firstAt, lastAt, visits, views, events, totaltime}], count, page}` | List sessions. Paged. Use for the "precise funnel" toggle and for a recent-visitors table. |
| `/websites/{id}/sessions/stats?startAt&endAt` | summary + hourly weekly grid `[7 × 24]` | **Goldmine**: weekly heatmap data ready-made. |
| `/websites/{id}/sessions/weekly?startAt&endAt` | weekly grid only | Lighter variant if only the heatmap is needed. |
| `/websites/{id}/sessions/{sessionId}/activity` | `[{createdAt, urlPath, urlQuery, eventName, ...}]` | Per-session replay for the precise-funnel computation and the "visitor journey" drawer. |
| `/websites/{id}/daterange` | `{startDate, endDate}` | Shows the true data-coverage window. Added 2026-03-11. |

### 3.3 Nice-to-have but skip for v1

- `/websites/{id}/metrics/expanded` — returns richer objects; not needed until we have properties to display beyond count.
- `/websites/{id}/session-data/properties` and `/session-data/values` — only useful if we ever set session-level custom properties via the tracker (we don't).

---

## 4. Response shape — one batch endpoint

Rename `umami-stats.js` → keep the file, extend it. The frontend calls it **once** per period change. The response is shaped around the dashboard's sections, not around Umami's endpoint layout, so the client can render directly without further joins.

```jsonc
{
  "period": "7d",
  "period_label": "Last 7 days",
  "range": { "startAt": 1712700000000, "endAt": 1713304800000 },
  "data_coverage": { "startDate": "...", "endDate": "..." },
  "generated_at": "2026-04-10T09:00:00Z",
  "cache": { "ttl_seconds": 30 },

  "summary": {
    "visitors":      { "value": 412, "prev": 301, "delta_pct": 36.9 },
    "pageviews":     { "value": 718, "prev": 520, "delta_pct": 38.1 },
    "visits":        { "value": 455, "prev": 340, "delta_pct": 33.8 },
    "bounce_rate":   { "value": 41.2, "prev": 48.5, "delta_pct": -15.1, "direction": "good" },
    "avg_time_sec":  { "value": 74,   "prev": 61,   "delta_pct": 21.3 },
    "active_now":    { "value": 3 },
    "apply_clicks":  { "value": 18,   "prev": 9,    "delta_pct": 100.0 },
    "template_copies": { "value": 6,  "prev": 2,    "delta_pct": 200.0 },
    "apply_rate_pct":  { "value": 4.37, "prev": 2.99, "delta_pct": 46.1 }
  },

  "funnel": {
    "mode": "aggregate",
    "steps": [
      { "name": "Visit",            "count": 412, "rate_from_prev": 1.0,    "rate_from_top": 1.0 },
      { "name": "Engaged",          "count": 242, "rate_from_prev": 0.587,  "rate_from_top": 0.587 },
      { "name": "Scrolled 50%",     "count": 138, "rate_from_prev": 0.570,  "rate_from_top": 0.335 },
      { "name": "Apply click",      "count": 18,  "rate_from_prev": 0.130,  "rate_from_top": 0.044 },
      { "name": "Template copy",    "count": 6,   "rate_from_prev": 0.333,  "rate_from_top": 0.015 },
      { "name": "Submitted (bot)",  "count": null, "manual": true, "note": "off-platform" }
    ],
    "by_role": [
      { "role": "marketing",  "visitors": 412, "apply_clicks": 18, "template_copies": 6, "rate_pct": 4.37 }
    ]
  },

  "timeseries": {
    "unit": "hour",
    "pageviews": [ { "t": "2026-04-03T00:00:00Z", "y": 23, "prev_y": 11 }, ... ],
    "sessions":  [ { "t": "2026-04-03T00:00:00Z", "y": 14, "prev_y": 8 }, ... ],
    "apply_clicks": [ { "t": "...", "y": 2, "prev_y": 0 }, ... ]
  },

  "heatmap_weekly": [
    [0, 0, 0, 0, ...24 values],  // Sunday
    [0, 1, 3, 5, ...],           // Monday
    ...                          // 7 rows × 24 cols
  ],

  "breakdowns": {
    "pages":     [ { "label": "/jd-marketing", "value": 318 }, ... ],
    "referrers": [ { "label": "t.me",          "value": 210 }, ... ],
    "channels":  [ { "label": "direct",        "value": 180 }, ... ],
    "utm":       [ { "source": "telegram", "medium": "post", "campaign": "hiring-mkt", "value": 94 }, ... ],
    "countries": [ { "label": "UA", "value": 142 }, { "label": "PL", "value": 76 }, ... ],
    "cities":    [ { "label": "Kyiv", "country": "UA", "value": 88 }, ... ],
    "devices":   [ { "label": "desktop", "value": 260 }, { "label": "mobile", "value": 145 }, ... ],
    "browsers":  [ { "label": "chrome",  "value": 280 }, ... ],
    "os":        [ { "label": "macOS",   "value": 160 }, ... ],
    "languages": [ { "label": "ru",      "value": 220 }, { "label": "en", "value": 160 }, ... ],
    "events":    [ { "label": "apply-click", "value": 18 }, { "label": "template-copy", "value": 6 }, ... ]
  },

  "recent_sessions": [
    {
      "id": "uuid",
      "country": "UA", "city": "Kyiv",
      "device": "desktop", "browser": "chrome", "os": "macOS",
      "firstAt": "...", "lastAt": "...",
      "views": 4, "events": 2, "duration_sec": 184,
      "reached_apply": true
    }
  ],

  "errors": []   // per-endpoint soft failures so the UI can degrade gracefully
}
```

**Design notes on the shape:**

- Every summary metric is `{ value, prev, delta_pct }` — one shape, one renderer.
- `direction: "good" | "bad"` overrides the default assumption that bigger = better (needed for bounce rate).
- Funnel is pre-computed server-side so the frontend renders one list, not arithmetic.
- Timeseries entries carry `prev_y` inline — the comparison period is already aligned, no second request from the client.
- `errors` is a list of `{ endpoint, message }` — one failed sub-call must not break the whole page.
- Cache the whole blob 30 s (already in the file) to spare the Umami quota and make period-toggle feel instant.

---

## 5. Visualization mapping

| Metric / section | Chart | Why |
|---|---|---|
| Summary tiles (visitors, pageviews, apply-clicks, apply-rate, bounce, avg time) | **KPI card with delta arrow + sparkline** | Sparkline gives trend context without a separate chart; the delta arrow carries the comparison. |
| Pageviews + sessions over time | **Dual-line area chart** with pageviews as filled area and sessions as line | Industry standard (Plausible, Umami, PostHog). Area emphasises volume, line shows unique-ness. |
| Pageviews vs. previous period | **Overlay line** (faded dashed line for prev) on the same chart | Matches how Amplitude and Umami natively render `compare=prev`. |
| Apply-click timeline | **Bar chart** (one bar per bucket) | Events are discrete, not continuous — bars communicate that better than a line. |
| Funnel (5 steps) | **Horizontal funnel / bar chart with width ∝ count**, step drop-off % shown between bars | Best for <10 steps; Amplitude, Mixpanel, Heap all use this. Avoid the literal "trapezoid funnel" — it distorts perception of the drop-off. |
| Funnel by role | **Small multiples** (one mini funnel per role) | Scales to many roles without a legend explosion. |
| Country distribution | **Choropleth world map** + table fallback | Map for recognition, table for exact numbers. Don't do one without the other. |
| City distribution | **Ranked horizontal bar chart** (top 10) | Maps don't show cities well at a glance. |
| Device / browser / OS mix | **Horizontal stacked bar** (one bar, three segments) OR small donut | Donut is fine because cardinality is always ≤5. Avoid pie charts with >5 slices. |
| Traffic sources / referrers | **Horizontal bar, top 10** | Long-tail data, rankable. Never use a pie chart here. |
| UTM campaigns | **Table with sortable columns** (source, medium, campaign, visitors, apply-rate) | Multi-dimensional — no single chart type fits. |
| Weekly activity heatmap (7×24) | **Heatmap grid** (days × hours) with colour = intensity | `sessions/stats` gives you this shape for free — use it. Answers "when do people visit?" instantly. |
| Scroll depth (if custom events added) | **Funnel bar chart** (25 / 50 / 75 / 100) | Same pattern as main funnel, smaller scale. |
| Recent sessions table | **Virtual-scroll table** with flag, device icon, duration, reached-apply badge | Copy Umami's own Sessions screen. Make rows clickable → open activity drawer. |
| Per-session activity drawer | **Vertical timeline** (pageview → event → pageview) | Best mental model for "what did this person do?" |
| Data coverage window | **Single line of text** below the period selector | Not a chart; it's a disclaimer. |

**Anti-patterns to avoid:**

- Pie chart with >5 slices.
- Literal trapezoid funnels (the visual slope lies about the data).
- Line chart for discrete events (apply-clicks).
- Dual y-axis — force one unit per chart.
- Percentages without sample size — always show `N=412` next to `4.4%`.

---

## 6. Comparison strategy — "vs. previous period"

### 6.1 Period alignment

Umami `/stats` and `/pageviews` both accept `compare=prev` or `compare=yoy`, and the response already carries a `comparison` object with the same shape. **Use it.** Don't compute comparison by making two range requests — Umami's comparison is already timezone-aligned and handles DST.

Fallback (for endpoints that don't support `compare`, e.g. `/metrics`): compute it manually by issuing a second request with shifted timestamps:

```
prev.startAt = current.startAt − (current.endAt − current.startAt)
prev.endAt   = current.startAt
```

### 6.2 Delta computation

```
delta_pct = (current − prev) / prev × 100        if prev > 0
delta_pct = null                                  if prev == 0     // show "new"
```

Never show `Infinity%`. For new activity (`prev == 0 && current > 0`), render a **"new"** badge. For zero activity both sides, render `—`.

### 6.3 Direction semantics

Some metrics invert:

- **Lower is better:** bounce rate, page load time, time-to-apply, exit rate.
- **Higher is better:** everything else.

Ship a per-metric `direction: "good" | "bad" | "neutral"` in the response so the UI colours the arrow without hardcoding a list.

### 6.4 Pitfalls

- **Short periods against weekend effects** — comparing Monday to Sunday always looks like growth. Default to 7-day rolling unless the user picks 24h explicitly.
- **Timezone drift** — always pass `timezone=Europe/Kyiv` (or user's IANA tz) to `/pageviews`, otherwise buckets shift.
- **Small sample noise** — suppress delta display when `prev < 10` (show the raw numbers instead). Otherwise a 2 → 6 change reads as "+200%" and overstates the trend.

---

## 7. Advanced techniques Umami cannot provide

List these up front in the architecture and **never** promise them in the UI.

| Capability | Why it's impossible | Workaround |
|---|---|---|
| **Session replay / DOM recording** | Umami does not record the DOM. | Use Microsoft Clarity or PostHog alongside Umami if this is ever needed. Both have free tiers. |
| **True cross-session user identity** | Umami sessions are anonymous hashes rotated monthly; there is no stable visitor ID. `distinctId` only exists if you set it client-side via the tracker's `identify()` call. | Opt-in: set `distinctId` = hashed Telegram handle if the user is already logged in. Rarely applicable for a public hiring landing. |
| **User paths / flow diagram (Sankey)** | Aggregated `/metrics` endpoints throw away sequence. Only `/sessions/{id}/activity` keeps order. | Reconstruct client-side by walking sessions activity. Expensive — skip for v1. |
| **Cohort retention** | Returning-visitor tracking in Umami is weak without `distinctId`. | Not applicable to a hiring landing anyway — one-shot conversion, no retention. Call it out explicitly so nobody asks. |
| **A/B test variant attribution** | No built-in experimentation. | Tag variant via URL param (`?v=a`) and break down by `/metrics?type=query`. Crude but works. |
| **Revenue attribution** | No revenue data. | N/A — hiring funnel has no revenue. |
| **Custom segments** | Umami has `segment` as a filter parameter (uuid) but segments must be built in the Umami UI, not via API. | For v1, express segments as multiple filter params (`country=UA&device=desktop`). |
| **Scroll depth out of the box** | Umami doesn't ship scroll tracking. | Emit `scroll-25/50/75/100` custom events from the page (4 lines of JS). |
| **Actual application submissions** | Submissions happen in `@ai_mind_set_team` Telegram bot. | Manual entry field on the dashboard, stored in a tiny JSON file or a Netlify Blob. Phase 2: read from the Telegram Bot API. |
| **Funnel with a conversion window** | Aggregate endpoints don't support "step 2 within 24h of step 1". | Compute client-side from `/sessions/{id}/activity` for the precise-funnel toggle. |
| **Time-to-convert distribution** | Same — needs session join. | Same workaround as above. |

---

## 8. Opinion — what makes this dashboard better than Umami itself

Umami's own dashboard is competent at counting. It is **terrible** at telling a story. Four things we can do that Umami won't:

1. **Frame everything as one funnel, not seven screens.**
   Umami shows pageviews, referrers, devices, and events on separate tabs. A hiring landing has one job — get qualified candidates to click apply — so everything on the page answers "where did this rate come from and why is it moving?" The funnel is the centrepiece, the other charts are its diagnostic traces.

2. **Show role-level conversion natively.**
   The `apply-click` event carries a `role` property. Umami's UI will let you filter by event but not easily break it down by a specific property. We compute per-role funnels server-side and render small multiples. This is the single most useful view for a hiring manager.

3. **Make "vs. previous period" the default, not a toggle.**
   Raw numbers without context are noise. Every tile ships with a delta, every time-series has a faded prev-period overlay, every breakdown table has a "change" column. Amplitude and Mixpanel do this. Umami doesn't by default. Steal the pattern.

4. **Honest about the last mile.**
   The funnel ends at "Submitted to bot" as a greyed-out step with a manual-input field. The dashboard does not pretend the job is over at `apply-click`. That honesty is what makes it a **hiring funnel dashboard** rather than a pageview counter — and it's the thing that makes Alex trust the number.

Bonus (phase 2):

5. **One-screen daily brief.** A "today vs yesterday, last 3 apply-clicks, top referrer, biggest drop-off" card that can be screenshotted and pasted into Telegram for the team standup. Umami has nothing like this.

6. **Real-time badge on the current live visitor's country/device** — cheap win via `/active` + a tiny poll.

7. **Annotations layer.** When a JD post goes live in the @aimindset channel, mark the timestamp on the timeseries. Makes cause-and-effect obvious.

---

## Appendix A — Umami filter vocabulary (as of 2026-03)

Shared by `/stats`, `/pageviews`, `/metrics`, `/events/*`, `/sessions`:

```
path, referrer, title, query, os, browser, device, country, region,
city, tag, hostname, language, event, segment (uuid), cohort (uuid),
eventType (int)
```

Breaking changes to remember:

- **2025-10-07:** `url` filter renamed to `path`, `host` renamed to `hostname`. The `/metrics?type=url` type was renamed to `type=path`. `umami-stats.js` currently uses `type=url`; this works today only because the Cloud gateway accepts the old name — **update to `type=path`** before it gets removed.
- **2024-05-23:** `/stats` response renamed `change` → `prev`, then further restructured in 2025-10 to the current `{value, comparison}` shape.

## Appendix B — `unit` parameter auto-downgrade

`/pageviews` and `/events/series` accept `unit = minute | hour | day | month | year`. Umami **silently** upgrades the unit when the range is too long (post v2.9):

| Unit | Max range |
|---|---|
| `minute` | 60 minutes |
| `hour` | 30 days |
| `day` | 6 months |
| `month` | no limit |
| `year` | no limit |

So if the frontend asks for `unit=hour` over a 90-day range, Umami returns daily buckets. The frontend must read back the actual spacing between `x` timestamps and re-label the axis — don't trust the requested unit.
