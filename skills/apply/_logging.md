# Session Logging — Guide for the Skill Engine

This file tells you (the Claude Code instance running the `/apply` assessment)
how to write session events. Logging is a **local-only GPS track** of the
candidate's process — **nothing leaves their machine** until they explicitly
submit.

## Where to write

Append one JSON object per line to:

```
~/aim-apply-session-{ts}/session.jsonl
```

`{ts}` is the session id (format `YYYY-MM-DD-HHmm`, local time, zero-padded).
Create the directory at session start if it does not exist. Use append mode —
never rewrite the file.

## Event schema

Every line is a single JSON object with exactly four keys:

```json
{ "ts": "2026-04-10T23:30:04Z", "event": "phase_enter", "phase": "profile", "meta": {} }
```

- **ts** — ISO 8601 UTC timestamp (`new Date().toISOString()`)
- **event** — one of the allowed event names below
- **phase** — current phase slug, or `null` if not phase-bound
- **meta** — small object with counts, durations, names. **Never free text.**

## Allowed event names

Only these strings may appear in `event`. Do not invent new ones.

| event                | when                                             | meta fields                               |
|----------------------|--------------------------------------------------|-------------------------------------------|
| `session_start`      | first action of the session                      | `{ role, plugin_version }`                |
| `phase_enter`        | candidate enters a phase                         | `{}`                                      |
| `phase_complete`     | candidate finishes a phase successfully          | `{ duration_ms }`                         |
| `phase_skipped`      | candidate chose to skip (e.g. reflection)        | `{ reason_code }` (enum, not free text)   |
| `artifact_written`   | file saved to session dir                        | `{ name, bytes, lines }`                  |
| `insight_committed`  | candidate confirms a self-insight block          | `{ count }`                               |
| `tool_used`          | any tool invocation by the skill (aggregate)     | `{ tool, count }`                         |
| `session_submit`     | candidate confirmed preview and hit submit       | `{ payload_bytes }`                       |
| `session_complete`   | submit endpoint returned 200                     | `{ total_duration_ms }`                   |

`reason_code` is a short slug: `time`, `not_applicable`, `stuck`, `other`.
Nothing else.

## Example JSONL

```jsonl
{"ts":"2026-04-10T23:30:04Z","event":"session_start","phase":null,"meta":{"role":"marketing","plugin_version":"0.1.0"}}
{"ts":"2026-04-10T23:30:05Z","event":"phase_enter","phase":"profile","meta":{}}
{"ts":"2026-04-10T23:34:12Z","event":"artifact_written","phase":"profile","meta":{"name":"profile.md","bytes":2418,"lines":64}}
{"ts":"2026-04-10T23:34:13Z","event":"phase_complete","phase":"profile","meta":{"duration_ms":248000}}
{"ts":"2026-04-10T23:34:14Z","event":"phase_enter","phase":"task","meta":{}}
{"ts":"2026-04-10T23:41:02Z","event":"tool_used","phase":"task","meta":{"tool":"Read","count":4}}
{"ts":"2026-04-10T23:41:02Z","event":"tool_used","phase":"task","meta":{"tool":"Write","count":2}}
{"ts":"2026-04-10T23:48:30Z","event":"artifact_written","phase":"task","meta":{"name":"task-output.md","bytes":5104,"lines":128}}
{"ts":"2026-04-10T23:48:31Z","event":"phase_complete","phase":"task","meta":{"duration_ms":857000}}
{"ts":"2026-04-10T23:50:10Z","event":"phase_skipped","phase":"reflection","meta":{"reason_code":"time"}}
{"ts":"2026-04-10T23:51:00Z","event":"session_submit","phase":null,"meta":{"payload_bytes":12843}}
{"ts":"2026-04-10T23:51:02Z","event":"session_complete","phase":null,"meta":{"total_duration_ms":1258000}}
```

## What NEVER goes in a log event

Hard rules. If you are tempted to log any of these, stop and log a count instead.

- **Message content** — no user turns, no assistant responses, no excerpts
- **File content** — no snippets of profile.md / task-output.md / reflection.md
- **Tool arguments** — no file paths, no URLs, no prompts, no queries
- **System info** — no PATH, hostname, username, IP, OS version, shell
- **Free-text fields** — no "what the candidate said", no summaries, no notes
- **Personally identifiable info** — no email, name, github handle, anything from profile

If it cannot be expressed as `{ name, count, bytes, lines, duration_ms, tool,
reason_code, role }`, **do not log it**.

## Computing phase durations

Keep an in-memory map `phaseEnteredAt = { profile: ts, task: ts, reflection: ts }`.

1. On `phase_enter` → store `Date.now()` under the phase key
2. On `phase_complete` or `phase_skipped` → compute `duration_ms = Date.now() - phaseEnteredAt[phase]`
3. Write that into `meta.duration_ms` (or drop it if phase entry was not
   recorded — never guess)

Do not persist `phaseEnteredAt` across sessions. Every session is independent.

## Tool usage counting

The goal is "how much did the candidate lean on each tool", not "what did they
do with it". Count by tool name only.

1. Keep an in-memory counter `toolCounts = { Read: 0, Write: 0, Edit: 0, Bash: 0, ... }`
2. Each time you invoke a tool on behalf of the candidate, increment
   `toolCounts[toolName] += 1`
3. **Do not write a log line per tool call.** Flush the counter at the end of
   each phase by emitting one `tool_used` line per tool with a non-zero count:
   `{ "event": "tool_used", "phase": "task", "meta": { "tool": "Read", "count": 4 } }`
4. Reset the counter after flushing

This keeps the log short and guarantees no tool arguments can leak.

## Writing safely

- Use synchronous append with a newline terminator: `fs.appendFileSync(path, line + "\n")`
- Never read the log back to parse it during the session — write-only
- If the write fails, log a warning to the user but do not crash the session
- On `session_complete`, the file stays on disk as the candidate's own copy

## Reminder

This log is the candidate's **process GPS track**, not a transcript. Everything
here is a count, a duration, or a name from a fixed allowlist. If in doubt,
log less.
