# Apply AI Native – Handoff

**Date:** 2026-04-08
**Session:** ~3h, 30+ sub-agents, 250+ sources

## Project

- **Repo (LIVE):** https://github.com/ai-mindset-org/aim-apply
- **Landing (LIVE):** https://ai-mindset-org.github.io/aim-apply/
- **Code:** `/Users/alex/Documents/_code/aim-apply/`
- **PRD:** `ai-mindset-2026/inbox/{AIM} {prd} Apply AI Native – Terminal Assessment System – 2026-04-07.md`
- **Research:** `ai-mindset-2026/inbox/{AIM} {research} Apply AI Native – Competitive Landscape and Technical Patterns – 2026-04-07.md`
- **Article:** `ai-mindset-2026/inbox/{AIM} {draft} The Terminal Is the New Resume – 2026-04-07.md`

## What's done

### Infrastructure
- GitHub repo `ai-mindset-org/aim-apply` (public, template)
- GitHub Pages landing (v4: one-screen, logo, AI Native Operator)
- OG preview image (og.png, 1200x630)
- PostToolUse hooks (settings.json, fixed format)
- Tracking scripts (start.sh, tracker.sh → session.jsonl + profile.json)
- GitHub Action (validate.yml → auto-comment on PR)
- Submit script (submit.sh → GitHub Issue with label `application`)
- Review dashboard (scripts/dashboard.html)
- `/start` slash command

### Content
- CLAUDE.md: assessment engine (Russian, 5 steps, role selection, scoring matrix)
- 4 tasks: introduce → wiki (Karpathy) → create (role-adaptive) → reflect
- 5 directions: content & growth, automation & systems, visual & creative, management & operations, community & support
- context/: about-aim.md (culture, team roster), products.md, role.md, raw-snippets.md
- Scoring: 4 dimensions × 4 tasks, binary pass/fail

### Research (13 agents, 250+ sources)
- 10 initial research reports (/tmp/research-1..10)
- 3 deep research: terminal hiring, AI skill assessment, behavioral tracking
- 3 technical approach: plugin vs skill vs npx, web submission, guided installers
- Competitive landscape document in team vault

## What's next (Priority 1: npx installer)

### Architecture decision: `npx aim-apply`

Research confirmed: npx wins over plugin and skill. One command, scaffolds everything.

**Build plan (~3h):**
1. `npm init` → create package with bin entry
2. bin/aim-apply.js: downloads repo contents (degit or direct), scaffolds workspace
3. Post-scaffold: prints "cd aim-apply && claude"
4. Publish to npm: `@aim/apply` or `aim-apply`
5. Update landing: `npx aim-apply` as primary CTA
6. Update README: npx as primary install method

### Other priorities
- DNS: apply.aimindset.org → GitHub Pages
- Landing: add expandable "под катом" sections (philosophy, role, scoring)
- Landing: SVG metaphor embedded
- Landing: live ticker (Shields.io badge for applications count)
- Web submission: Netlify Function → GitHub Issue API (alternative to gh CLI)
- Tasks: review knowledge wiki task, tighten instructions
- Article: finalize "The Terminal Is the New Resume"
- Plugin version: optional, for deeper integration

## Prompt for next session

продолжи работу над Apply AI Native.

проект: /Users/alex/Documents/_code/aim-apply/
handoff: CONTEXT-HANDOFF.md
repo: https://github.com/ai-mindset-org/aim-apply
landing: https://ai-mindset-org.github.io/aim-apply/

главная задача: создать npx пакет aim-apply.
research подтвердил: npx > plugin > skill.
план: npm init → bin/aim-apply.js (degit scaffold) → publish → update landing.

также:
- landing: добавить expandable секции (philosophy, role)
- landing: SVG метафора
- landing: Shields.io ticker заявок
- DNS: apply.aimindset.org
- article: финализировать
