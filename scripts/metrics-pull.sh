#!/usr/bin/env bash
# metrics-pull.sh — fetch Umami stats for aim-apply and render markdown reports
#
# writes:
#   metrics/weekly.md          — current snapshot (overwrite)
#   metrics/history/YYYY-Www.md — versioned weekly archive
#   docs/stats.html            — public static stats page (overwrite)
#
# usage:
#   bash scripts/metrics-pull.sh
#
# requires: UMAMI_API_KEY in ~/.config/aim-apply/umami-key, jq, curl
# cron:
#   0 6 * * 1 /Users/alex/Documents/_code/aim-apply/scripts/metrics-pull.sh

set -euo pipefail

# ---------- config ----------
WEBSITE_ID="7ea4880d-b761-4f50-838a-1eed2dd3f443"
WEBSITE_NAME="AI Mindset Apply"
BASE_URL="https://api.umami.is/v1"
KEY_FILE="$HOME/.config/aim-apply/umami-key"
REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
METRICS_DIR="$REPO_ROOT/metrics"
HISTORY_DIR="$METRICS_DIR/history"
WEEKLY_FILE="$METRICS_DIR/weekly.md"
HTML_FILE="$REPO_ROOT/docs/stats.html"

# ---------- preflight ----------
if [ ! -f "$KEY_FILE" ]; then
    echo "error: API key not found at $KEY_FILE"
    exit 1
fi
if ! command -v jq &> /dev/null; then
    echo "error: jq not installed (brew install jq)"
    exit 1
fi
API_KEY=$(cat "$KEY_FILE")
mkdir -p "$METRICS_DIR" "$HISTORY_DIR"

# ---------- time range: last 7 days ----------
NOW_S=$(date -u +%s)
WEEK_AGO_S=$((NOW_S - 7 * 86400))
NOW_MS=$((NOW_S * 1000))
WEEK_AGO_MS=$((WEEK_AGO_S * 1000))
ISO_NOW=$(date -u +"%Y-%m-%dT%H:%M:%SZ")
WEEK_NUM=$(date -u +"%Y-W%V")
GEN_DATE=$(date -u +"%Y-%m-%d %H:%M UTC")

API_HEADER="x-umami-api-key: $API_KEY"

fetch() {
    curl -sS -H "$API_HEADER" "$BASE_URL/websites/$WEBSITE_ID/$1"
}

# ---------- fetch ----------
echo "pulling stats from $BASE_URL..."
STATS=$(fetch "stats?startAt=$WEEK_AGO_MS&endAt=$NOW_MS")
ACTIVE=$(fetch "active")
PAGES=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=url")
REFERRERS=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=referrer")
BROWSERS=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=browser")
OS_LIST=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=os")
DEVICES=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=device")
COUNTRIES=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=country")
EVENTS=$(fetch "metrics?startAt=$WEEK_AGO_MS&endAt=$NOW_MS&type=event")

# ---------- extract values ----------
PAGEVIEWS=$(echo "$STATS" | jq -r '.pageviews // 0')
VISITORS=$(echo "$STATS" | jq -r '.visitors // 0')
VISITS=$(echo "$STATS" | jq -r '.visits // 0')
BOUNCES=$(echo "$STATS" | jq -r '.bounces // 0')
TOTALTIME=$(echo "$STATS" | jq -r '.totaltime // 0')
AVG_SEC=0
if [ "$VISITS" -gt 0 ]; then
    AVG_SEC=$((TOTALTIME / VISITS))
fi
AVG_TIME_FMT=$(printf "%dm %02ds" $((AVG_SEC / 60)) $((AVG_SEC % 60)))
BOUNCE_RATE=0
if [ "$VISITS" -gt 0 ]; then
    BOUNCE_RATE=$(awk "BEGIN{printf \"%.1f\", ($BOUNCES/$VISITS)*100}")
fi
ACTIVE_NOW=$(echo "$ACTIVE" | jq -r '.visitors // 0')

# ---------- build markdown tables ----------
md_table_from_metrics() {
    local json="$1"
    local header="$2"
    echo "$json" | jq -r --arg h "$header" '
        if type == "array" and length > 0 then
            "| " + $h + " | visits |\n|---|---|\n" +
            (map("| " + (.x // "unknown") + " | " + (.y|tostring) + " |") | join("\n"))
        else
            "_no data yet_"
        end
    '
}

PAGES_TABLE=$(md_table_from_metrics "$PAGES" "page")
REFERRERS_TABLE=$(md_table_from_metrics "$REFERRERS" "source")
BROWSERS_TABLE=$(md_table_from_metrics "$BROWSERS" "browser")
DEVICES_TABLE=$(md_table_from_metrics "$DEVICES" "device")
COUNTRIES_TABLE=$(md_table_from_metrics "$COUNTRIES" "country")
EVENTS_TABLE=$(md_table_from_metrics "$EVENTS" "event")

# ---------- render weekly.md ----------
cat > "$WEEKLY_FILE" << EOF
---
name: AI Mindset Apply — weekly metrics
website_id: $WEBSITE_ID
generated_at: $GEN_DATE
period: last 7 days
source: Umami Cloud API
dashboard: https://cloud.umami.is/websites/$WEBSITE_ID
---

# aim-apply — weekly metrics

> **period:** last 7 days · **generated:** $GEN_DATE · **week:** $WEEK_NUM
>
> source: [Umami Cloud](https://cloud.umami.is/websites/$WEBSITE_ID)
> auto-updated by \`scripts/metrics-pull.sh\`

## overall

| metric | value |
|---|---|
| **pageviews** | $PAGEVIEWS |
| **unique visitors** | $VISITORS |
| **visits (sessions)** | $VISITS |
| **avg time on page** | $AVG_TIME_FMT |
| **bounce rate** | $BOUNCE_RATE% |
| **active right now** | $ACTIVE_NOW |

## pages (by visits)

$PAGES_TABLE

## top referrers

$REFERRERS_TABLE

## events (custom tracking)

$EVENTS_TABLE

tracked events:
- \`apply-click\` — clicks on "написать в команду" button (with role metadata)
- \`template-copy\` — clicks on "скопировать шаблон" button

## browsers

$BROWSERS_TABLE

## devices

$DEVICES_TABLE

## countries

$COUNTRIES_TABLE

## links

- **live dashboard:** https://cloud.umami.is/websites/$WEBSITE_ID
- **public stats page:** https://ai-mindset-org.github.io/aim-apply/stats.html
- **landing (marketing):** https://ai-mindset-org.github.io/aim-apply/jd-marketing.html

---

*file auto-generated by \`metrics-pull.sh\`. do not edit manually — your changes will be overwritten on next run.*
EOF

# archive historical copy
cp "$WEEKLY_FILE" "$HISTORY_DIR/$WEEK_NUM.md"

echo "✓ wrote $WEEKLY_FILE"
echo "✓ archived to $HISTORY_DIR/$WEEK_NUM.md"

# ---------- render stats.html ----------
cat > "$HTML_FILE" << HTMLEOF
<!DOCTYPE html>
<html lang="ru">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>stats — aim-apply</title>
    <link rel="icon" type="image/svg+xml" href="favicon.svg">
    <link href="https://fonts.googleapis.com/css2?family=IBM+Plex+Mono:wght@300;400;500;600&family=Space+Grotesk:wght@500;600;700&display=swap" rel="stylesheet">
    <style>
        :root {
            --bg: #161620;
            --accent: #4dc9d4;
            --text: #e8e8ef;
            --dim: rgba(232,232,239,0.58);
            --muted: rgba(232,232,239,0.32);
            --border: rgba(77,201,212,0.14);
        }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        html { background: var(--bg); color: var(--text); font-family: 'IBM Plex Mono', monospace; }
        body {
            min-height: 100vh;
            background-image:
                linear-gradient(rgba(77,201,212,0.022) 1px, transparent 1px),
                linear-gradient(90deg, rgba(77,201,212,0.022) 1px, transparent 1px);
            background-size: 60px 60px;
            padding: 60px 24px;
        }
        .wrap { max-width: 800px; margin: 0 auto; }
        h1 { font-family: 'Space Grotesk', sans-serif; font-size: 42px; font-weight: 700; margin-bottom: 8px; }
        h1 span { color: var(--accent); }
        .sub { color: var(--dim); font-size: 14px; margin-bottom: 40px; }
        .sub code { background: rgba(255,255,255,0.04); padding: 2px 6px; border-radius: 3px; }
        h2 { font-family: 'Space Grotesk', sans-serif; font-size: 18px; font-weight: 600; color: var(--accent); letter-spacing: 0.08em; text-transform: uppercase; margin: 48px 0 16px; padding-bottom: 8px; border-bottom: 1px solid var(--border); }
        .kpi-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(140px, 1fr)); gap: 16px; margin-bottom: 20px; }
        .kpi { padding: 22px; border: 1px solid var(--border); background: rgba(13,13,23,0.4); }
        .kpi .label { font-size: 10px; color: var(--muted); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 8px; }
        .kpi .value { font-family: 'Space Grotesk', sans-serif; font-size: 32px; font-weight: 700; color: var(--text); line-height: 1; }
        .kpi .value.accent { color: var(--accent); }
        table { width: 100%; border-collapse: collapse; margin-bottom: 20px; font-size: 13px; }
        th, td { text-align: left; padding: 10px 14px; border-bottom: 1px solid var(--border); }
        th { color: var(--muted); font-weight: 500; font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; }
        td { color: var(--dim); }
        td:last-child { text-align: right; color: var(--accent); font-family: 'Space Grotesk', sans-serif; font-weight: 600; }
        .links { margin-top: 56px; padding-top: 32px; border-top: 1px solid var(--border); font-size: 12px; color: var(--muted); line-height: 2; }
        .links a { color: var(--accent); text-decoration: none; opacity: 0.7; }
        .links a:hover { opacity: 1; }
        .note { margin-top: 32px; padding: 16px 20px; border-left: 2px solid var(--accent); background: rgba(77,201,212,0.04); font-size: 12px; color: var(--dim); }
    </style>
</head>
<body>
    <div class="wrap">
        <h1><span>/</span>stats</h1>
        <p class="sub">$WEBSITE_NAME · last 7 days · generated <code>$GEN_DATE</code></p>

        <h2>overall</h2>
        <div class="kpi-grid">
            <div class="kpi"><div class="label">pageviews</div><div class="value accent">$PAGEVIEWS</div></div>
            <div class="kpi"><div class="label">visitors</div><div class="value accent">$VISITORS</div></div>
            <div class="kpi"><div class="label">visits</div><div class="value">$VISITS</div></div>
            <div class="kpi"><div class="label">avg time</div><div class="value">$AVG_TIME_FMT</div></div>
            <div class="kpi"><div class="label">bounce</div><div class="value">$BOUNCE_RATE%</div></div>
            <div class="kpi"><div class="label">active now</div><div class="value accent">$ACTIVE_NOW</div></div>
        </div>

        <h2>pages</h2>
$(echo "$PAGES" | jq -r '
    if type == "array" and length > 0 then
        "<table><thead><tr><th>page</th><th>visits</th></tr></thead><tbody>" +
        (map("<tr><td>" + (.x // "unknown") + "</td><td>" + (.y|tostring) + "</td></tr>") | join("")) +
        "</tbody></table>"
    else
        "<p style=\"color:var(--muted);font-size:13px\">no data yet</p>"
    end
')

        <h2>top referrers</h2>
$(echo "$REFERRERS" | jq -r '
    if type == "array" and length > 0 then
        "<table><thead><tr><th>source</th><th>visits</th></tr></thead><tbody>" +
        (map("<tr><td>" + (.x // "direct") + "</td><td>" + (.y|tostring) + "</td></tr>") | join("")) +
        "</tbody></table>"
    else
        "<p style=\"color:var(--muted);font-size:13px\">no data yet</p>"
    end
')

        <h2>events</h2>
$(echo "$EVENTS" | jq -r '
    if type == "array" and length > 0 then
        "<table><thead><tr><th>event</th><th>count</th></tr></thead><tbody>" +
        (map("<tr><td>" + (.x // "unknown") + "</td><td>" + (.y|tostring) + "</td></tr>") | join("")) +
        "</tbody></table>"
    else
        "<p style=\"color:var(--muted);font-size:13px\">no events tracked yet. click <code>apply-click</code> (написать в команду) or <code>template-copy</code> on jd-marketing.html to see them here.</p>"
    end
')

        <h2>devices</h2>
$(echo "$DEVICES" | jq -r '
    if type == "array" and length > 0 then
        "<table><thead><tr><th>device</th><th>visits</th></tr></thead><tbody>" +
        (map("<tr><td>" + (.x // "unknown") + "</td><td>" + (.y|tostring) + "</td></tr>") | join("")) +
        "</tbody></table>"
    else
        "<p style=\"color:var(--muted);font-size:13px\">no data yet</p>"
    end
')

        <div class="note">
            this page is <strong>auto-generated</strong> from Umami Cloud API by <code>scripts/metrics-pull.sh</code>.
            updates via cron job (weekly) or manual run. for real-time dashboard, visit Umami directly.
        </div>

        <div class="links">
            <strong style="color:var(--dim)">links:</strong><br>
            → <a href="https://cloud.umami.is/websites/$WEBSITE_ID">live dashboard (private)</a><br>
            → <a href="jd-marketing.html">/ai-native marketing lead</a><br>
            → <a href="/">/apply root</a><br>
            → <a href="https://github.com/ai-mindset-org/aim-apply">github repo</a>
        </div>
    </div>
</body>
</html>
HTMLEOF

echo "✓ wrote $HTML_FILE"
echo ""
echo "=== summary ==="
echo "  pageviews: $PAGEVIEWS"
echo "  visitors: $VISITORS"
echo "  visits: $VISITS"
echo "  active now: $ACTIVE_NOW"
echo ""
echo "next: review $WEEKLY_FILE, then git add + commit + push stats.html"
