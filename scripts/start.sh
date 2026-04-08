#!/usr/bin/env bash
# start.sh — initialize assessment session
set -euo pipefail

TRACKING_DIR="$(cd "$(dirname "$0")/.." && pwd)/tracking"
OUTPUTS_DIR="$(cd "$(dirname "$0")/.." && pwd)/outputs"

mkdir -p "$TRACKING_DIR" "$OUTPUTS_DIR"

# Read session info from stdin
INPUT=$(cat)
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // "unknown"')
TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Log session start
jq -cn \
  --arg event "session_start" \
  --arg ts "$TIMESTAMP" \
  --arg sid "$SESSION_ID" \
  '{event: $event, timestamp: $ts, session_id: $sid}' \
  >> "$TRACKING_DIR/session.jsonl"

# Initialize progress if not exists
if [ ! -f "$OUTPUTS_DIR/progress.json" ]; then
  echo '{"started": "'"$TIMESTAMP"'", "session_id": "'"$SESSION_ID"'"}' > "$OUTPUTS_DIR/progress.json"
fi
