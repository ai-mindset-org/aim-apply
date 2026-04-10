# Submit Flow — Guide for the Skill Engine

This file tells you how to run the submit phase: generate a preview, get
explicit consent, POST the payload, handle success and failure.

**Privacy principle:** nothing leaves the candidate's machine until they see
exactly what will be sent and type `y`.

## Step 1 — Collect the pieces

From the session directory `~/aim-apply-session-{ts}/`:

- `session.jsonl` — read all lines, `JSON.parse` each → `events[]`
- `profile.md` — read as string → `artifacts.profile`
- `task-output.md` — read as string → `artifacts.task_output`
- `reflection.md` — read as string → `artifacts.reflection` (empty string if
  the phase was skipped)

Also collect:

- `session_id` — the `{ts}` slug
- `role` — from `session_start` event meta
- `plugin_version` — constant for this skill version

## Step 2 — Build the preview

The preview shows **bytes and line counts**, never content.

```
you are about to send the following to ai mindset:

  session id:     2026-04-10-2330
  role:           marketing
  plugin version: 0.1.0

  ┌─ artifacts ─────────────────────────────┬───────┬───────┐
  │ file                                    │ bytes │ lines │
  ├─────────────────────────────────────────┼───────┼───────┤
  │ profile.md                              │ 2,418 │    64 │
  │ task-output.md                          │ 5,104 │   128 │
  │ reflection.md                           │ 1,207 │    31 │
  └─────────────────────────────────────────┴───────┴───────┘

  ┌─ events ────────────────────────────────┬───────┐
  │ type                                    │ count │
  ├─────────────────────────────────────────┼───────┤
  │ phase_enter                             │     3 │
  │ phase_complete                          │     2 │
  │ phase_skipped                           │     1 │
  │ artifact_written                        │     3 │
  │ tool_used                               │     7 │
  │ insight_committed                       │     4 │
  └─────────────────────────────────────────┴───────┘

  total payload: ~12.5 KB

destination: ai-mindset-org/aim-apply-submissions (private)
stored at:   submissions/marketing/2026-04-10-2330.json
```

Compute `bytes` via `Buffer.byteLength(content, "utf8")`. Compute `lines` via
`content.split("\n").length`. Payload total = stringified JSON body length.

**Do not print file contents in the preview.** Not a first line, not a
summary, not a count of headings. Bytes and lines only.

## Step 3 — Consent prompt

Show the candidate the exact lowercase Russian prompt. Accept `y` / `yes` /
`да` / `д` as confirmation. Anything else (including empty input) means no.

```
отправить? [y/N]:
```

On anything but yes:

```
не отправлено. всё осталось у тебя на машине: ~/aim-apply-session-2026-04-10-2330/
```

Then exit cleanly — **do not** retry, do not re-prompt, do not auto-send later.

## Step 4 — Build the request

```js
const body = {
  session_id,
  role,
  events,
  artifacts: {
    profile,
    task_output,
    reflection,
  },
  consent: true,
  plugin_version: "0.1.0",
  consent_ts: new Date().toISOString(),
};
```

POST to:

```
POST https://apply.aimindset.org/.netlify/functions/submit
Content-Type: application/json
```

(Or the current deploy URL — check `netlify.toml` / plugin config.)

## Step 5 — Handle the response

### Success — 200 with `{ status: "ok", session_id }`

1. Append a `session_submit` event with `meta.payload_bytes`
2. Append a `session_complete` event with `meta.total_duration_ms`
3. Show the wait-three-days message:

```
отправлено.

ваш ответ у нас — посмотрим в ближайшие 3 рабочих дня. если попадёте в
короткий список, напишем в телеграм. если нет — тоже напишем, коротко.

всё, что ты написал, осталось у тебя на машине:
  ~/aim-apply-session-2026-04-10-2330/
```

### Failure — any non-200, network error, timeout

1. Save the full payload to `~/aim-apply-session-{ts}/submit-payload.json`
   as a local backup
2. Show the error and offer retry:

```
отправка не прошла: {status} {short reason}

payload сохранён: ~/aim-apply-session-2026-04-10-2330/submit-payload.json

повторить? [y/N]:
```

3. On retry → re-POST the same body (do not rebuild — the consent timestamp
   and event list must be identical)
4. On second failure → stop retrying. Tell the candidate to ping
   `apply@aimindset.org` and attach `submit-payload.json` manually. **Do not
   email for them.** Do not auto-upload anywhere else.

### Specific status codes

- `400` — payload shape is wrong. Show the server's error field, do not retry
- `413` — payload too large (>500 KB). Tell the candidate the artifact files
  are too big and to trim `task-output.md`. Do not auto-trim
- `503` — backend not configured yet. Show: "приём заявок временно выключен —
  попробуй через час или напиши apply@aimindset.org"

## Things this flow must not do

- Never POST without explicit `y`
- Never retry silently in the background
- Never send the payload to any endpoint other than `submit.js`
- Never include anything in the payload that was not in the preview
- Never modify `session.jsonl` between preview and POST (events added after
  the preview — `session_submit`, `session_complete` — are appended *after*
  the server responds)
