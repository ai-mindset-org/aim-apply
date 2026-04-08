# Apply AI Native – Handoff

**Date:** 2026-04-08
**Session:** ~3h build, 30+ sub-agents, 250+ sources researched
**Status:** MVP live, npx + plugin scaffolded but not published

---

## 3 project directories

| Project | Path | Git remote | Status |
|---------|------|------------|--------|
| **aim-apply** (main repo) | `/Users/alex/Documents/_code/aim-apply/` | `github.com/ai-mindset-org/aim-apply` | LIVE, 16 commits |
| **aim-apply-npx** | `/Users/alex/Documents/_code/aim-apply-npx/` | `github.com/aPoWall/Code` (wrong) | scaffolded, NOT published to npm |
| **aim-apply-plugin** | `/Users/alex/Documents/_code/aim-apply-plugin/` | `github.com/aPoWall/Code` (wrong) | scaffolded, NOT tested |

### Linked resources

- **Repo:** https://github.com/ai-mindset-org/aim-apply (public, template repo)
- **Landing:** https://ai-mindset-org.github.io/aim-apply/ (GitHub Pages)
- **PRD:** `ai-mindset-2026/inbox/{AIM} {prd} Apply AI Native – Terminal Assessment System – 2026-04-07.md`
- **Research:** `ai-mindset-2026/inbox/{AIM} {research} Apply AI Native – Competitive Landscape and Technical Patterns – 2026-04-07.md`
- **Article:** `ai-mindset-2026/inbox/{AIM} {draft} The Terminal Is the New Resume – 2026-04-07.md`

---

## What's done (complete list)

### Main repo – infrastructure

- [x] GitHub repo `ai-mindset-org/aim-apply` (public, template)
- [x] GitHub Pages landing page (`docs/index.html`) – v4, one-screen hero + below-fold accordion (philosophy, about, directions, how it works, scoring)
- [x] Design system: teal-grid style (#161620 bg, #4dc9d4 accent), IBM Plex Mono + Space Grotesk, circuit SVG decorations, noise overlay
- [x] OG preview image (`docs/og.png`, 1200x630) + `docs/og-preview.html` source
- [x] Logo: `docs/logo.png`
- [x] 3 cover variants: `docs/covers/tg-banner.html`, `docs/covers/ig-story.html`, `docs/covers/square-card.html`
- [x] Metaphor SVG: `docs/metaphor.svg` (~10KB) + `docs/metaphor-preview.html`
- [x] PostToolUse hooks (`.claude/settings.json`) – tracks every Bash/Edit/Write/Read/Grep/Glob/Agent/WebSearch/WebFetch call
- [x] SessionStart hook – runs `scripts/start.sh` to initialize session.jsonl + progress.json
- [x] Tracking scripts: `scripts/start.sh` (session init), `scripts/tracker.sh` (tool usage → session.jsonl + profile.json)
- [x] Submit script: `scripts/submit.sh` → creates GitHub Issue with label `application`, includes all outputs + tracking data
- [x] Review dashboard: `scripts/dashboard.html` – drag-drop session.jsonl + profile.json, shows journey graph, tool bars, behavioral signals, scoring matrix, timeline. Has `?demo` mode
- [x] `/start` slash command (`.claude/commands/start.md`) – launches assessment flow
- [x] MIT license

### Main repo – assessment content

- [x] **CLAUDE.md** – full assessment engine: 5 steps, bilingual (RU default + EN), role selection, scoring dimensions, submission flow, auto-start on any first message
- [x] 4 task files in `tasks/`:
  - `01-introduce.md` – name, background, AI tool stack, direction choice (3 min)
  - `02-research.md` – raw snippets → structured wiki with cross-references (7 min)
  - `03-create.md` – role-adaptive artifact creation: content/automation/visual/ops/community/mix (10 min)
  - `04-reflect.md` – instruments, "if 2h", ideal week, one-sentence pitch + scoring transparency (5 min)
- [x] 6 directions: content & growth, automation & systems, visual & creative, management & operations, community & support, mix
- [x] 4 context files:
  - `context/about-aim.md` – culture doc (team, values, red/green flags, leadership inspo table)
  - `context/products.md` – 5 products + internal tools table
  - `context/role.md` – "AI Native Operator" philosophy, 6 directions, AI fluency levels (0-4), anti-patterns
  - `context/raw-snippets.md` – 4 raw snippets for wiki task (POS interview, Founder OS, TG post, Labs docs)
- [x] Scoring: 4 dimensions (Technical Skill, Thinking/Logic, Taste/Design, Initiative) x 4 tasks, binary pass/fail

### npx package (`aim-apply-npx/`)

- [x] `package.json` – name `aim-apply`, version 1.0.0, bin entry, MIT, engines >=16
- [x] `bin/aim-apply.js` – scaffolding script: ASCII banner, copies templates dir, chmod scripts, prints next steps
- [x] `templates/` – full mirror of main repo content (CLAUDE.md, context/, tasks/, scripts/, .claude/)
- [x] `templates/.gitignore`, `templates/outputs/.gitkeep`, `templates/tracking/.gitkeep`
- [x] `README.md` – usage instructions
- [ ] NOT published to npm yet
- [ ] git remote points to wrong repo (`aPoWall/Code` instead of `ai-mindset-org/aim-apply-npx`)

### Plugin version (`aim-apply-plugin/`)

- [x] `.claude-plugin/plugin.json` – manifest with commands, agents, hooks
- [x] 3 commands: `start.md` (env scan + assessment), `progress.md` (status dashboard), `submit.md` (GitHub Issue + env snapshot)
- [x] `agents/guide.md` – Sonnet agent with full AIM context, raw snippets, role descriptions, env-adaptive behavior (4 difficulty levels based on skills/MCP count)
- [x] `hooks/hooks.json` – SessionStart, PostToolUse (async), SessionEnd tracking
- [x] `scripts/env-scanner.sh` – scans candidate's CC setup: skills count/list, CLAUDE.md size, MCP servers, hooks, memory files, git, gh CLI, CC version, OS
- [x] `scripts/tracker.sh` – session-aware tracker with per-session JSONL files + aggregate profile.json
- [x] `README.md` – comparison table repo vs plugin, data directory structure
- [ ] NOT tested end-to-end
- [ ] git remote points to wrong repo

### Research artifacts (completed, in team vault)

- [x] 10 initial research reports on terminal hiring, AI assessment, behavioral tracking
- [x] 3 deep research threads
- [x] 3 technical approach analyses (plugin vs skill vs npx, web submission, guided installers)
- [x] Competitive landscape document

---

## What's next (prioritized)

### P0 – Ship npx package
1. Fix git remote for `aim-apply-npx` (should be `ai-mindset-org/aim-apply-npx` or similar)
2. Test `npx aim-apply` locally (symlink or `npm link`)
3. Publish to npm: `npm publish` (package name `aim-apply` appears available)
4. Update landing page: `npx aim-apply` as primary CTA alongside `git clone`
5. Update README: npx as recommended install method

### P1 – DNS and distribution
6. DNS: `apply.aimindset.org` CNAME → `ai-mindset-org.github.io` (use Timeweb API or `/AIM-domain`)
7. Create `application` label on GitHub repo (needed by submit.sh)
8. Test full assessment flow end-to-end (clone → tasks → submit → review dashboard)

### P2 – Landing improvements
9. Landing: embed metaphor SVG in hero or as background element
10. Landing: update terminal block from `git push + gh pr create` to `bash scripts/submit.sh` (matches actual flow)
11. Landing: Shields.io badge for applications count (GitHub Issues with `application` label)
12. Landing: responsive testing on mobile

### P3 – Plugin version
13. Create separate GitHub repo for plugin (`ai-mindset-org/aim-apply-plugin`)
14. Test plugin end-to-end: `claude plugin add ./aim-apply-plugin` → `/aim-apply:start` → submit
15. Fix env-scanner.sh edge cases (no jq, no skills dir, etc.)
16. Consider publishing to Claude Code plugin registry when available

### P4 – Content and polish
17. Article: finalize "The Terminal Is the New Resume" draft
18. Review wiki task instructions – tighten expected output format
19. Add example outputs (gold standard for internal calibration)
20. Consider adding a timer/progress indicator in CLAUDE.md
21. Create GitHub Action `validate.yml` for auto-comment on PRs (mentioned in old handoff but not in repo)

---

## Key architectural decisions

| Decision | Rationale |
|----------|-----------|
| **GitHub Issue for submission** (not PR) | Simpler for candidates, no fork needed. submit.sh creates Issue with label `application`. PR approach was considered but adds friction |
| **3 distribution channels**: git clone (primary), npx (planned primary), plugin (advanced) | git clone works now, npx is the best UX, plugin adds env-scanning for deeper signal |
| **CLAUDE.md as assessment engine** | The repo itself IS the assessment – Claude reads CLAUDE.md and guides the candidate. No external server needed |
| **PostToolUse hooks for tracking** | Every tool call logged to session.jsonl. Non-intrusive, candidate knows about it (stated in welcome message). Gives behavioral signal (tool diversity, agent usage, duration) |
| **Role-adaptive Step 3** | Creative task changes based on chosen direction. 6 tracks: content, automation, visual, ops, community, mix |
| **Binary scoring (pass/fail)** | 4 dimensions x 4 tasks matrix. No numeric scores exposed to candidate – only dimensions shown in Step 4 |
| **Russian by default** | Team communicates in Russian. English switch if candidate prefers. Tech terms always English |
| **No GitHub Action yet** | Planned `validate.yml` not implemented. Currently review is manual via dashboard.html |
| **Plugin stores data in** `~/.claude/plugins/data/aim-apply/` | Separate from project dir, persists across sessions, includes env-snapshot |

---

## Bugs found and fixed

| Bug | Fix | Commit |
|-----|-----|--------|
| Hooks format wrong (flat array instead of matcher+hooks) | Restructured `.claude/settings.json` to correct `{matcher, hooks: [{type, command}]}` format | `a654bd2` |
| OG image too small, text unreadable at social preview size | v2: 160px title, inline logo, corner accents | `ff1f745` |

### Known issues (unfixed)

| Issue | Severity | Notes |
|-------|----------|-------|
| `aim-apply-npx` and `aim-apply-plugin` have wrong git remote (`aPoWall/Code`) | medium | Need to create proper repos and update remotes |
| `aim-apply` npm package not published | high | Core blocker for npx distribution |
| `application` label may not exist on GitHub repo | low | submit.sh will fail if label missing – need to create it |
| Landing terminal block shows `git push + gh pr create` but actual flow uses `bash scripts/submit.sh` → GitHub Issue | low | Cosmetic mismatch |
| No GitHub Action for auto-validation of submissions | low | Planned but not implemented |
| Plugin not tested end-to-end | medium | env-scanner may have edge cases on non-macOS or minimal setups |

---

## File tree (main repo)

```
aim-apply/
├── CLAUDE.md                        ← assessment engine (176 lines)
├── CONTEXT-HANDOFF.md               ← this file
├── README.md                        ← public readme with badges
├── .claude/
│   ├── commands/start.md            ← /start slash command
│   └── settings.json                ← hooks config (SessionStart + PostToolUse)
├── context/
│   ├── about-aim.md                 ← team culture, values, red/green flags
│   ├── products.md                  ← 5 products + internal tools
│   ├── raw-snippets.md              ← 4 raw snippets for wiki task
│   └── role.md                      ← AI Native Operator definition
├── docs/
│   ├── index.html                   ← landing page (GitHub Pages)
│   ├── logo.png                     ← AIM logo
│   ├── og.png                       ← OG preview image 1200x630
│   ├── og-preview.html              ← OG source
│   ├── metaphor.svg                 ← visual metaphor (~10KB)
│   ├── metaphor-preview.html        ← metaphor source
│   └── covers/
│       ├── tg-banner.html           ← Telegram banner
│       ├── ig-story.html            ← Instagram story
│       └── square-card.html         ← Square card format
├── scripts/
│   ├── start.sh                     ← session init hook
│   ├── tracker.sh                   ← tool usage tracker
│   ├── submit.sh                    ← submission → GitHub Issue
│   └── dashboard.html               ← review dashboard (drag-drop)
├── tasks/
│   ├── 01-introduce.md              ← Step 1: profile + direction
│   ├── 02-research.md               ← Step 2: raw → wiki
│   ├── 03-create.md                 ← Step 3: role-adaptive artifact
│   └── 04-reflect.md                ← Step 4: reflection + scoring reveal
├── outputs/                         ← candidate fills (gitignored)
└── tracking/                        ← auto-logged (gitignored)
```

---

## Prompt for next session

продолжи работу над Apply AI Native.

проект: `/Users/alex/Documents/_code/aim-apply/`
handoff: `CONTEXT-HANDOFF.md`
repo: https://github.com/ai-mindset-org/aim-apply
landing: https://ai-mindset-org.github.io/aim-apply/

3 директории:
- main: `/Users/alex/Documents/_code/aim-apply/`
- npx: `/Users/alex/Documents/_code/aim-apply-npx/`
- plugin: `/Users/alex/Documents/_code/aim-apply-plugin/`

**главная задача: опубликовать npx пакет aim-apply.**
1. создать GitHub repo для npx (или использовать main repo + отдельный npm publish)
2. проверить `npx aim-apply` локально через `npm link`
3. `npm publish` на npm
4. обновить landing: `npx aim-apply` как основной CTA
5. обновить README

также:
- DNS: apply.aimindset.org → GitHub Pages (Timeweb API)
- создать label `application` на GitHub repo
- протестировать полный flow: clone → 4 задания → submit → review dashboard
- landing: исправить terminal block (submit.sh вместо gh pr create)
- landing: Shields.io badge для счётчика заявок
- article: финализировать "The Terminal Is the New Resume"
