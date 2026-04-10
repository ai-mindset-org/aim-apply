#!/usr/bin/env bash
# test-deploy.sh — smoke test for aim-apply dual deploy (GH Pages + Netlify)
#
# Usage:
#   NETLIFY_URL=https://apply-aimindset.netlify.app bash scripts/test-deploy.sh
#
# Exit codes:
#   0 — all checks passed
#   1 — one or more checks failed
#
# Requirements: curl, jq

set -u
set -o pipefail

# ─── Config ──────────────────────────────────────────────────────────────────

GH_PAGES_URL="${GH_PAGES_URL:-https://ai-mindset-org.github.io/aim-apply}"
NETLIFY_URL="${NETLIFY_URL:-}"
UMAMI_KEY_FILE="${UMAMI_KEY_FILE:-$HOME/.config/aim-apply/umami-key}"
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ─── Colors ──────────────────────────────────────────────────────────────────

if [[ -t 1 ]]; then
  GREEN='\033[0;32m'; RED='\033[0;31m'; YELLOW='\033[0;33m'; DIM='\033[2m'; RESET='\033[0m'
else
  GREEN=''; RED=''; YELLOW=''; DIM=''; RESET=''
fi

PASS="${GREEN}✓${RESET}"
FAIL="${RED}✗${RESET}"
WARN="${YELLOW}!${RESET}"

PASS_COUNT=0
FAIL_COUNT=0
WARN_COUNT=0
RESULTS=()

# ─── Helpers ─────────────────────────────────────────────────────────────────

record() {
  local status="$1"; local label="$2"; local detail="${3:-}"
  case "$status" in
    pass) RESULTS+=("${PASS} ${label}"); PASS_COUNT=$((PASS_COUNT+1)) ;;
    fail) RESULTS+=("${FAIL} ${label}${detail:+ ${DIM}— ${detail}${RESET}}"); FAIL_COUNT=$((FAIL_COUNT+1)) ;;
    warn) RESULTS+=("${WARN} ${label}${detail:+ ${DIM}— ${detail}${RESET}}"); WARN_COUNT=$((WARN_COUNT+1)) ;;
  esac
  printf "%b\n" "${RESULTS[-1]}"
}

http_status() {
  curl -sSL -o /dev/null -w "%{http_code}" --max-time 15 "$1" 2>/dev/null || echo "000"
}

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || {
    printf "%b missing required command: %s\n" "$FAIL" "$1" >&2
    exit 1
  }
}

# ─── Pre-flight ──────────────────────────────────────────────────────────────

require_cmd curl
require_cmd jq

printf "\n${DIM}aim-apply deploy smoke test${RESET}\n"
printf "${DIM}GH Pages:${RESET} %s\n" "$GH_PAGES_URL"
printf "${DIM}Netlify: ${RESET} %s\n" "${NETLIFY_URL:-<not set>}"
printf "${DIM}Umami key:${RESET} %s\n\n" "$UMAMI_KEY_FILE"

if [[ -z "$NETLIFY_URL" ]]; then
  printf "%b NETLIFY_URL not set — skipping Netlify checks\n\n" "$WARN"
fi

# ─── 1. Umami API key present (for reference / future direct checks) ────────

if [[ -f "$UMAMI_KEY_FILE" ]]; then
  UMAMI_KEY="$(tr -d '[:space:]' < "$UMAMI_KEY_FILE")"
  if [[ -n "$UMAMI_KEY" ]]; then
    record pass "umami key file present ($UMAMI_KEY_FILE)"
  else
    record warn "umami key file empty"
    UMAMI_KEY=""
  fi
else
  record warn "umami key file missing ($UMAMI_KEY_FILE)"
  UMAMI_KEY=""
fi

# ─── 2. GH Pages: jd-marketing.html returns 200 ──────────────────────────────

CODE=$(http_status "$GH_PAGES_URL/jd-marketing.html")
if [[ "$CODE" == "200" ]]; then
  record pass "GH Pages jd-marketing.html → 200"
else
  record fail "GH Pages jd-marketing.html → $CODE"
fi

# ─── 3. GH Pages: stats.html returns 200 ─────────────────────────────────────

CODE=$(http_status "$GH_PAGES_URL/stats.html")
if [[ "$CODE" == "200" ]]; then
  record pass "GH Pages stats.html → 200"
else
  record fail "GH Pages stats.html → $CODE"
fi

# ─── 4. Netlify: root, landing, analytics return 200 ─────────────────────────

if [[ -n "$NETLIFY_URL" ]]; then
  CODE=$(http_status "$NETLIFY_URL/")
  if [[ "$CODE" == "200" ]]; then
    record pass "Netlify root → 200"
  else
    record fail "Netlify root → $CODE"
  fi

  CODE=$(http_status "$NETLIFY_URL/jd-marketing.html")
  if [[ "$CODE" == "200" ]]; then
    record pass "Netlify jd-marketing.html → 200"
  else
    record fail "Netlify jd-marketing.html → $CODE"
  fi

  CODE=$(http_status "$NETLIFY_URL/analytics.html")
  if [[ "$CODE" == "200" ]]; then
    record pass "Netlify analytics.html → 200"
  else
    record fail "Netlify analytics.html → $CODE"
  fi
fi

# ─── 5. Netlify function returns valid JSON with expected fields ─────────────

if [[ -n "$NETLIFY_URL" ]]; then
  FN_URL="$NETLIFY_URL/.netlify/functions/umami-stats?period=24h"
  FN_BODY="$(curl -sS --max-time 20 "$FN_URL" 2>/dev/null || echo "")"

  if [[ -z "$FN_BODY" ]]; then
    record fail "umami-stats function — empty response"
  elif ! printf '%s' "$FN_BODY" | jq -e . >/dev/null 2>&1; then
    record fail "umami-stats function — invalid JSON" "$(printf '%s' "$FN_BODY" | head -c 80)"
  else
    record pass "umami-stats function → valid JSON"

    # Check for key fields: pageviews, visitors (may be nested under .stats or top-level)
    HAS_PV=$(printf '%s' "$FN_BODY" | jq -r '.. | objects | select(has("pageviews")) | .pageviews' | head -1)
    HAS_VIS=$(printf '%s' "$FN_BODY" | jq -r '.. | objects | select(has("visitors")) | .visitors' | head -1)

    if [[ -n "$HAS_PV" && "$HAS_PV" != "null" ]]; then
      record pass "  field 'pageviews' present (value: $HAS_PV)"
    else
      record fail "  field 'pageviews' missing"
    fi

    if [[ -n "$HAS_VIS" && "$HAS_VIS" != "null" ]]; then
      record pass "  field 'visitors' present (value: $HAS_VIS)"
    else
      record fail "  field 'visitors' missing"
    fi

    # Surface any error property the function might have returned
    ERR=$(printf '%s' "$FN_BODY" | jq -r '.error // empty')
    if [[ -n "$ERR" ]]; then
      record fail "  function returned error field" "$ERR"
    fi
  fi
fi

# ─── 6. Umami tracking script present on landing page (via HTTP) ─────────────

if [[ -n "$NETLIFY_URL" ]]; then
  LANDING_BODY="$(curl -sSL --max-time 15 "$NETLIFY_URL/jd-marketing.html" 2>/dev/null || echo "")"
  if [[ -n "$LANDING_BODY" ]] && printf '%s' "$LANDING_BODY" | grep -q "cloud.umami.is/script.js"; then
    record pass "Netlify jd-marketing.html contains Umami tracking script"
  else
    record fail "Netlify jd-marketing.html missing Umami script tag"
  fi
else
  LANDING_BODY="$(curl -sSL --max-time 15 "$GH_PAGES_URL/jd-marketing.html" 2>/dev/null || echo "")"
  if [[ -n "$LANDING_BODY" ]] && printf '%s' "$LANDING_BODY" | grep -q "cloud.umami.is/script.js"; then
    record pass "GH Pages jd-marketing.html contains Umami tracking script"
  else
    record fail "GH Pages jd-marketing.html missing Umami script tag"
  fi
fi

# ─── 7. Local source has apply-click event (prevents regression) ─────────────

LOCAL_LANDING="$REPO_ROOT/docs/jd-marketing.html"
if [[ -f "$LOCAL_LANDING" ]]; then
  if grep -q 'data-umami-event="apply-click"' "$LOCAL_LANDING"; then
    record pass "local jd-marketing.html has data-umami-event=\"apply-click\""
  else
    record fail "local jd-marketing.html missing data-umami-event=\"apply-click\""
  fi

  if grep -q 'data-umami-event="template-copy"' "$LOCAL_LANDING"; then
    record pass "local jd-marketing.html has data-umami-event=\"template-copy\""
  else
    record warn "local jd-marketing.html missing data-umami-event=\"template-copy\""
  fi
else
  record warn "local jd-marketing.html not found at $LOCAL_LANDING"
fi

# ─── Summary ─────────────────────────────────────────────────────────────────

printf "\n${DIM}──────────────────────────────────${RESET}\n"
printf "summary: ${GREEN}%d passed${RESET}" "$PASS_COUNT"
[[ $FAIL_COUNT -gt 0 ]] && printf ", ${RED}%d failed${RESET}" "$FAIL_COUNT"
[[ $WARN_COUNT -gt 0 ]] && printf ", ${YELLOW}%d warnings${RESET}" "$WARN_COUNT"
printf "\n\n"

if [[ $FAIL_COUNT -gt 0 ]]; then
  exit 1
fi
exit 0
