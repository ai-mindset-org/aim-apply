# scoring rubric -- aim-apply assessment

binary pass/fail per dimension per task. no scales, no partial credit.

---

## dimension 1: Technical Skill

> can they operate in the terminal, use agents, manage files, and work with tools fluently?

### scored in: 02 wiki, 03 create

**02 research + wiki -- pass when:**
- created proper directory structure (`outputs/wiki/`)
- files have valid markdown with frontmatter or headers
- used Read to explore context files before synthesizing
- used appropriate tools (Grep/Glob for search, Write/Edit for creation)
- no broken links or orphan files in wiki

**02 research + wiki -- fail when:**
- dumped everything into one file instead of structured wiki
- broken file references or missing index.md
- did not read source context files (visible in tracking)
- wiki pages are clearly copy-pasted without restructuring

**03 create -- pass when:**
- artifact actually works (HTML renders, script runs, markdown is valid)
- used appropriate tools for the task (not just Bash echo)
- file organization makes sense (correct output directory)
- bonus: used Agent for parallel subtasks, used WebSearch for inspiration

**03 create -- fail when:**
- artifact is broken or incomplete (HTML with syntax errors, script that crashes)
- saved output in wrong location or forgot to save
- no evidence of using AI tools in the creative process
- copy-pasted a template without meaningful customization

---

## dimension 2: Thinking/Logic

> can they synthesize information, prioritize, and think structurally?

### scored in: 02 wiki, 03 create, 04 reflect

**02 research + wiki -- pass when:**
- categories in index.md are logical (not just alphabetical dump)
- synthesized information from multiple snippets into single entities
- identified non-obvious connections between concepts
- wiki structure enables navigation (someone unfamiliar could find things)
- entities have concrete facts and numbers, not vague summaries

**02 research + wiki -- fail when:**
- index.md is a flat list with no categorization
- each snippet became its own page (no synthesis across sources)
- connections between entities are superficial or absent
- wiki reads like a summary, not a knowledge system

**03 create -- pass when:**
- scope is appropriate for 10 minutes (not too ambitious, not trivial)
- artifact shows clear intent and logical structure
- content role: post has a thesis, not just facts. content plan has variety.
- systems role: addresses a real problem with a practical solution
- visual role: design choices serve communication (not decoration)
- ops role: process has clear steps, owners, and timing
- community role: FAQ answers are specific, not generic

**03 create -- fail when:**
- scope misjudgment: planned a massive system but delivered nothing
- artifact lacks internal logic (random collection of ideas)
- content is generic and could apply to any company
- solution does not connect to AIM's actual needs

**04 reflect -- pass when:**
- specific about which tools and why (not "I used AI")
- "2 hours" answer shows understanding of AIM's real needs
- "ideal week" is realistic and shows self-knowledge
- "why me" statement is specific and evidenced, not empty
- demonstrates awareness of own strengths and gaps

**04 reflect -- fail when:**
- answers are vague or generic ("I'd improve everything")
- no self-awareness about limitations
- "ideal week" describes a fantasy, not a workplan
- "why me" is a cliche ("I'm passionate about AI")
- did not reference anything from the actual assessment experience

---

## dimension 3: Taste/Design

> is the output well-structured, readable, and aesthetically considered?

### scored in: 02 wiki, 03 create, 04 reflect

**02 research + wiki -- pass when:**
- consistent markdown style across wiki pages
- headers, lists, and emphasis used meaningfully (not randomly)
- index.md is scannable -- you can find things in 5 seconds
- cross-references are contextual (not just "[see also: X]")
- entity pages have clear hierarchy: title > summary > details > links

**02 research + wiki -- fail when:**
- inconsistent formatting across pages
- walls of text with no structure
- headers used decoratively, not functionally
- cross-references feel forced or mechanical

**03 create -- pass when:**
- content role: writing matches AIM tone (lowercase, direct, no corporate speak, EN DASH)
- systems role: code is readable, has comments or README where needed
- visual role: follows dark theme / terminal aesthetic, typography is intentional
- ops role: document is clean, could be used as-is by the team
- community role: tone is warm but not cheesy, information is well-organized
- in any role: the artifact looks like someone cared about the details

**03 create -- fail when:**
- writing style does not match AIM culture (formal, corporate, emoji-heavy)
- visual output is generic (default colors, no design intent)
- code is messy, unreadable, no structure
- markdown has broken formatting
- output feels rushed -- no proofreading, no polish

**04 reflect -- pass when:**
- reflection is well-structured (follows the template or improves on it)
- writing is concise -- no filler, no repetition
- tone is genuine and direct
- "one sentence" is actually compelling and memorable

**04 reflect -- fail when:**
- disorganized thoughts with no clear structure
- overwrites -- says in 200 words what could be said in 40
- corporate tone in a personal reflection
- reads like it was auto-generated without human editing

---

## dimension 4: Initiative

> did they go beyond the minimum? did they propose, not just execute?

### scored in: 01 introduce, 02 wiki, 03 create, 04 reflect

**01 introduce -- pass when:**
- provided links (GitHub, portfolio, anything)
- offered more context than asked (projects, side work, philosophy)
- asked a question back (about AIM, about the role)
- picked a specific role with reasoning, not just "mix"
- tone shows personality, not a template response

**01 introduce -- fail when:**
- gave minimal answers (name + "I like AI")
- no links, no elaboration, no questions
- just picked "mix" without explanation
- felt like filling out a form

**02 research + wiki -- pass when:**
- created more than the minimum 3 entity pages
- used WebSearch to find additional information beyond provided context
- added original observations or analysis (not just repackaging)
- proposed categories or structure that wasn't in the snippets
- noticed gaps in the information and flagged them

**02 research + wiki -- fail when:**
- exactly 3 pages, no more -- did the bare minimum
- no web research, only used provided files
- no original thought -- pure reorganization of existing text
- skipped cross-references or did them mechanically

**03 create -- pass when:**
- chose the bonus option (content plan, README, responsive, metrics)
- went beyond the brief (added something not asked for)
- the artifact addresses a real AIM need, not a generic exercise
- created multiple artifacts when one was sufficient
- used Agent to parallelize or accelerate creation

**03 create -- fail when:**
- did only the minimum requirement
- artifact is generic (could be for any company, not AIM-specific)
- no evidence of exploration or experimentation
- skipped the bonus entirely without attempting it

**04 reflect -- pass when:**
- "2 hours" answer is specific and actionable (not just "more of the same")
- referenced specific moments from their assessment
- proposed improvements to the assessment itself
- showed awareness of AIM's culture and values in their answers
- "why me" connects their actual demonstrated work to team needs

**04 reflect -- fail when:**
- answers feel disconnected from what they actually did
- no mention of specific tools or approaches used
- vague aspirations instead of concrete plans
- "why me" does not reference any evidence from the session

---

## overall recommendation thresholds

### STRONG HIRE (10-12 / 12)
- passes in all four dimensions with minimal fails
- at least one moment of genuine surprise (did something unexpected)
- cultural fit signals: lowercase writing, direct tone, initiative without prompting
- tool usage: green signals dominate, Agent >= 2, diverse toolkit

### MAYBE (6-9 / 12)
- passes in most dimensions but has clear gaps
- solid execution but limited initiative, or strong initiative but weak execution
- may need coaching on specific skills but shows potential
- tool usage: mixed signals, some green and some yellow

### PASS (0-5 / 12)
- multiple fails across dimensions
- fundamental gaps in technical skill, thinking, or taste
- limited initiative -- did only what was asked
- tool usage: red signals dominate, minimal tool diversity
- cultural mismatch: formal tone, waited for instructions, no personality

---

## calibration notes

these are guidelines, not a formula. the overall recommendation should also consider:

- **trajectory** -- is this someone who would grow fast at AIM?
- **cultural signal** -- do they communicate like the team? direct, specific, human?
- **unique angle** -- do they bring something the team currently lacks?
- **role fit** -- even if overall score is moderate, they might be exceptional for a specific role
- **red flag override** -- a single critical red flag (e.g., zero initiative, cannot use terminal) can override a good score

the matrix gives structure. the recommendation requires judgment.
