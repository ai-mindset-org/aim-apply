---
name: aim-apply:apply
description: Use when running AI Mindset hiring assessment. Triggers on `/aim-apply:apply [role]`. Roles: general, marketing, automation, visual, ops. Opens consent screen, routes to role-specific 3-phase flow, manages session logging to local session.jsonl, handles submit at end.
---

# AI Mindset Apply — Hiring Assessment Router

This skill is the entry point for candidates applying to AI Mindset team via Claude Code.

## How it works

User runs `/aim-apply:apply <role>` where role is one of: `general`, `marketing`, `automation`, `visual`, `ops`. If no role, default to `general`.

### Step 1: Show consent screen
Read `_consent.md` for the exact text and checklist. Show it, wait for user to confirm. If declined, exit politely.

### Step 2: Create session directory
Create `~/aim-apply-session-{YYYY-MM-DD-HHmm}/` with:
- `session.jsonl` — event log
- `profile.md`, `task-output.md`, `reflection.md` — phase artifacts (empty scaffolds)
Log `session_start` event.

### Step 3: Route to role flow
Based on role arg:
- `general` → read and follow `general.md`
- `marketing` → read and follow `marketing.md`
- `automation` → read and follow `automation.md`
- `visual` → read and follow `visual.md`
- `ops` → read and follow `ops.md`

Each role flow drives 3 phases: profile → task → reflection. Between phases, log `phase_complete` event per `_logging.md`.

### Step 4: Submit
When candidate finishes all 3 phases, follow `_submit.md`: preview what gets sent, get explicit consent, POST to `https://aim-apply.netlify.app/.netlify/functions/submit`.

### Step 5: Session complete
Log `session_complete`, thank candidate, show expected timeline (3 days).

## Do not

- Never POST session data before explicit submit consent
- Never log message contents or tool arguments — only event names, phase names, counts, durations
- Never fabricate assessment scores or role matches — just run the flow
- Never skip phases — each phase is mandatory

## Files in this skill

- `SKILL.md` — this router
- `_consent.md` — consent screen text
- `_logging.md` — how to write session.jsonl events
- `_submit.md` — submit flow + payload shape
- `general.md`, `marketing.md`, `automation.md`, `visual.md`, `ops.md` — role-specific 3-phase flows
