---
name: aim-review
description: Use when reviewing a candidate's aim-apply submission. Triggers on: review application, review candidate, aim-review, review PR, review issue, оценить кандидата, ревью заявки.
---

# /aim-review -- candidate submission review

review a candidate's aim-apply assessment and produce a structured evaluation report.

## who uses this

**Alex** (Founder & Vision Lead) and **Ira** (Operations Partner) use this skill to evaluate submissions from `ai-mindset-org/aim-apply`.

## input

one of:
1. **GitHub Issue URL** -- created by `scripts/submit.sh` (label: `application`)
2. **GitHub PR URL** -- if candidate submitted via PR
3. **Local path** -- to a candidate's approved `outputs/` directory

if no input provided, ask:
```
вставь ссылку на GitHub Issue / PR кандидата, или укажи путь к локальным файлам.
```

## workflow

### 1. gather data

**from GitHub Issue/PR:**
- use `gh issue view <URL> --json title,body,labels,createdAt,author` or `gh pr view`
- extract: candidate name, role, and approved artifact contents
- if PR: also check `gh pr diff <URL>` to see actual files

**from local files:**
- read `outputs/profile.md` -- candidate identity and role
- read `outputs/wiki/index.md` + all wiki pages -- research quality
- read `outputs/reflection.md` -- self-awareness
- read all other files in `outputs/` -- creative artifacts
### 2. score each dimension

read `skills/review/rubric.md` for detailed criteria.

score **each dimension per task** as binary pass/fail. a dimension is only scored where applicable (see matrix below):

```
                    Technical  Thinking  Taste   Initiative
                    Skill      Logic     Design
------------------------------------------------------------
01 introduce        --         --        --      scored
02 research+wiki    scored     scored    scored  scored
03 create           scored     scored    scored  scored
04 reflect          --         scored    scored  scored
```

for each scored cell, evaluate against the rubric criteria and mark:
- `pass` -- meets or exceeds the bar
- `fail` -- does not meet the bar
- `--` -- not applicable for this task

### 5. generate review report

output format:

```markdown
# review: [Candidate Name] -- [Role]

**date:** YYYY-MM-DD
**source:** [link to Issue/PR]
**reviewer:** /aim-review skill

## candidate profile

- **name:** ...
- **location:** ...
- **role:** ...
- **background:** 1-2 sentences
- **AI tools:** list from profile
- **why AIM:** 1 sentence summary
- **links:** if any

## environment snapshot

[table from step 2]

## tool usage analysis

### green flags
- ...

### yellow flags
- ...

### red flags
- ...

## task-by-task evaluation

### 01 introduce
- **Initiative:** pass/fail -- [1 sentence why]
- **notes:** [anything notable about how they presented themselves]

### 02 research + wiki
- **Technical Skill:** pass/fail -- [evidence]
- **Thinking/Logic:** pass/fail -- [evidence]
- **Taste/Design:** pass/fail -- [evidence]
- **Initiative:** pass/fail -- [evidence]
- **wiki stats:** X pages, X cross-references, X categories
- **notes:** [quality of synthesis, original insights]

### 03 create
- **Technical Skill:** pass/fail -- [evidence]
- **Thinking/Logic:** pass/fail -- [evidence]
- **Taste/Design:** pass/fail -- [evidence]
- **Initiative:** pass/fail -- [evidence]
- **artifact type:** [what they built]
- **notes:** [scope judgment, quality, originality]

### 04 reflect
- **Thinking/Logic:** pass/fail -- [evidence]
- **Taste/Design:** pass/fail -- [evidence]
- **Initiative:** pass/fail -- [evidence]
- **notes:** [self-awareness, honesty, vision]

## scoring matrix

|                  | Technical | Thinking | Taste | Initiative | total |
|------------------|-----------|----------|-------|------------|-------|
| 01 introduce     | --        | --       | --    | ?/1        | ?/1   |
| 02 wiki          | ?/1       | ?/1      | ?/1   | ?/1        | ?/4   |
| 03 create        | ?/1       | ?/1      | ?/1   | ?/1        | ?/4   |
| 04 reflect       | --        | ?/1      | ?/1   | ?/1        | ?/3   |
| **dimension**    | ?/2       | ?/3      | ?/3   | ?/4        | **?/12** |

## overall recommendation

**[STRONG HIRE / MAYBE / PASS]**

[2-3 sentences: key strengths, key concerns, fit with AIM culture]

**best fit role:** [which of the 6 directions suits them based on evidence]
**compare to bar:** [where they sit relative to AIM green/red flags from about-aim.md]
```

### 6. compare with previous candidates (optional)

if `skills/review/reviews/` directory exists and contains previous reviews:
- list past candidates with their scores and recommendations
- position this candidate relative to the group
- note if this is the strongest/weakest in any dimension

add a section:

```markdown
## candidate comparison

| candidate | role | score | recommendation | date |
|-----------|------|-------|----------------|------|
| ...       | ...  | X/12  | ...            | ...  |

**relative position:** [where this candidate stands]
```

if no previous reviews exist, skip this section silently.

### 7. save review

save the report to:
```
skills/review/reviews/[candidate-name-lowercase]-[YYYY-MM-DD].md
```

create `skills/review/reviews/` directory if it does not exist.

announce:
```
review saved: skills/review/reviews/[filename].md

summary:
- [name] -- [role] -- [score]/12 -- [STRONG HIRE / MAYBE / PASS]
- strongest: [dimension]
- weakest: [dimension]
```

## scoring philosophy

refer to `skills/review/rubric.md` for all criteria. key principles:

- **process > polish** -- how they use tools matters more than pixel perfection
- **initiative is the tiebreaker** -- when in doubt, look at what they did beyond the brief
- **self-awareness > self-promotion** -- honest reflection scores higher than empty confidence
- **cultural fit is implicit** -- AIM green/red flags from `context/about-aim.md` inform the overall recommendation but are not a separate score

## edge cases

- **incomplete submission** -- if steps are missing, score only what exists. note which steps were skipped. this itself is a signal (negative for Initiative).
- **non-standard outputs** -- if candidate saved files in unexpected locations or formats, give credit for the content. penalize only if files are genuinely missing.
- **language mismatch** -- candidate may have submitted in English or Russian. evaluate content quality regardless of language.
