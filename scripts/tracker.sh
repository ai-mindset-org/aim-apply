#!/usr/bin/env bash
# tracker.sh — track tool usage per session
# Receives JSON from stdin: {"tool_name":"...", "session_id":"..."}
set -euo pipefail

TRACKING_DIR="$(cd "$(dirname "$0")/.." && pwd)/tracking"
mkdir -p "$TRACKING_DIR"

# Read JSON from stdin
INPUT=$(cat)
TOOL_NAME=$(echo "$INPUT" | jq -r '.tool_name // empty')
SESSION_ID=$(echo "$INPUT" | jq -r '.session_id // empty')

if [ -z "$TOOL_NAME" ] || [ -z "$SESSION_ID" ]; then
  exit 0
fi

TIMESTAMP=$(date -u +"%Y-%m-%dT%H:%M:%SZ")

# Append tool_use event
jq -n \
  --arg event "tool_use" \
  --arg ts "$TIMESTAMP" \
  --arg tool "$TOOL_NAME" \
  --arg sid "$SESSION_ID" \
  '{event: $event, timestamp: $ts, tool: $tool, session_id: $sid}' \
  >> "$TRACKING_DIR/session.jsonl"

# Update aggregate profile
PROFILE_FILE="$TRACKING_DIR/profile.json"

if [ ! -f "$PROFILE_FILE" ]; then
  echo '{"tools":{}, "total": 0}' > "$PROFILE_FILE"
fi

UPDATED=$(jq \
  --arg tool "$TOOL_NAME" \
  '.tools[$tool] = ((.tools[$tool] // 0) + 1) | .total = (.total + 1)' \
  "$PROFILE_FILE")

echo "$UPDATED" > "$PROFILE_FILE"
