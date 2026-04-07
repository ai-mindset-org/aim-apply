#!/usr/bin/env bash
# submit.sh — автоматическая отправка результатов assessment
# Создаёт GitHub Issue в ai-mindset-org/aim-apply с результатами
set -euo pipefail

REPO="ai-mindset-org/aim-apply"
OUTPUTS_DIR="outputs"
TRACKING_DIR="tracking"

# Check if gh is installed
if ! command -v gh &> /dev/null; then
    echo "gh (GitHub CLI) не установлен."
    echo "установи: brew install gh"
    echo ""
    echo "или отправь результаты вручную:"
    echo "1. зайди на https://github.com/$REPO/issues/new"
    echo "2. заголовок: Apply: [Имя] – [Направление]"
    echo "3. приложи zip с outputs/ и tracking/"
    exit 1
fi

# Check if logged in
if ! gh auth status &> /dev/null 2>&1; then
    echo "нужно авторизоваться в GitHub CLI:"
    echo "gh auth login"
    exit 1
fi

# Read profile
NAME="unknown"
ROLE="unknown"
if [ -f "$OUTPUTS_DIR/profile.md" ]; then
    NAME=$(grep -i "имя:" "$OUTPUTS_DIR/profile.md" | head -1 | sed 's/.*имя:[[:space:]]*//' | sed 's/\*//g' || echo "unknown")
    ROLE=$(grep -i "направление:" "$OUTPUTS_DIR/profile.md" | head -1 | sed 's/.*направление:[[:space:]]*//' | sed 's/\*//g' || echo "unknown")
fi

echo "отправляю результаты..."
echo "имя: $NAME"
echo "направление: $ROLE"
echo ""

# Collect files
FILES_LIST=""
for f in $(find "$OUTPUTS_DIR" -type f ! -name ".gitkeep" 2>/dev/null); do
    FILES_LIST="$FILES_LIST\n### $(basename $f)\n\`\`\`\n$(cat "$f")\n\`\`\`\n"
done

# Tracking summary
TRACKING_SUMMARY=""
if [ -f "$TRACKING_DIR/profile.json" ]; then
    TRACKING_SUMMARY=$(cat "$TRACKING_DIR/profile.json")
fi

TOOL_EVENTS=0
if [ -f "$TRACKING_DIR/session.jsonl" ]; then
    TOOL_EVENTS=$(wc -l < "$TRACKING_DIR/session.jsonl" | tr -d ' ')
fi

# Create issue body
BODY=$(cat <<ISSUE_EOF
## Apply: $NAME – $ROLE

### tracking summary
- tool events: $TOOL_EVENTS
\`\`\`json
$TRACKING_SUMMARY
\`\`\`

### outputs
$(echo -e "$FILES_LIST")

---
*submitted via scripts/submit.sh*
ISSUE_EOF
)

# Create the issue
ISSUE_URL=$(gh issue create \
    --repo "$REPO" \
    --title "Apply: $NAME – $ROLE" \
    --body "$BODY" \
    --label "application" 2>&1)

echo ""
echo "готово! результаты отправлены:"
echo "$ISSUE_URL"
echo ""
echo "мы посмотрим в течение 2–3 дней."
