# testing the apply flow

> инструкция для локального теста aim-apply — как для команды AI Mindset, так и для кандидатов

## что такое apply flow

terminal-based application session в Claude Code. ~25 минут, 3 фазы:

1. **профиль** (5 мин) — разговор про твой стек, опыт, AI workflow
2. **задания** (15 мин) — 2 задания по направлению (marketing / automation / visual / ops)
3. **рефлексия** (5 мин) — 2 финальных вопроса + генерация scoring

результат: 6-осевой профиль (AI Fluency / Tool Stack / Strategy / Execution / Taste / Initiative), артефакты в `outputs/`, полный session log в `tracking/session.jsonl`.

---

## requirements

- [Claude Code](https://docs.anthropic.com/en/docs/claude-code) установлен (`npm i -g @anthropic-ai/claude-code`)
- `git` для клонирования репо
- терминал (bash/zsh)
- ~25 минут свободного времени + любопытство

проверка окружения:
```bash
which claude       # → /opt/homebrew/bin/claude или подобное
claude --version   # → любая актуальная версия
git --version      # → git 2.x+
```

---

## method 1 — локальный тест (для команды / внутренней валидации)

это то, что ты запускаешь, чтобы **посмотреть, как flow работает своими глазами**, без деплоя.

### шаг 1 — клонировать репо

```bash
git clone https://github.com/ai-mindset-org/aim-apply.git
cd aim-apply
```

### шаг 2 — запустить Claude Code с initial prompt

это **критический шаг** — Claude Code не стартует assessment автоматически. Первый prompt должен явно сказать "прочитай CLAUDE.md и начни".

```bash
claude "начни assessment — прочитай CLAUDE.md и покажи welcome-сообщение. направление: marketing"
```

замени `marketing` на своё направление, если тестируешь другое:
- `marketing` — content & growth (есть tasks)
- `automation` — automation & systems (fallback на marketing)
- `visual` — visual & creative (fallback)
- `ops` — management & operations (fallback)

### шаг 3 — что ты должен увидеть

Claude Code покажет welcome-блок из `CLAUDE.md`:
```
  привет. это assessment для AI Mindset — ~25 минут.

  три части: разговор про тебя, пара заданий, рефлексия.

  всё, что ты делаешь в этой сессии, логируется
  (tool usage, timing) — это часть оценки.
  не как слежка, а как proof of how you work.

  результаты видны только команде AI Mindset, не публично.

  если ок — поехали. тебе на русском удобно?
```

если видишь это — ✓ auto-start работает.

если Claude начинает что-то другое (например, сразу читает файлы или запускает bash) — это баг. проверь, что в начале CLAUDE.md есть раздел `## CRITICAL: auto-start`.

### шаг 4 — пройди три фазы

работай как реальный кандидат. отвечай честно. **не торопись** — flow рассчитан на 25 минут. Claude ведёт тебя сам, по одному вопросу за раз.

все твои артефакты будут писаться в:
- `outputs/profile.md` — фаза 1
- `outputs/post.md`, `outputs/content-plan.md` — фаза 2 (для marketing)
- `outputs/reflection.md`, `outputs/scores.json` — фаза 3
- `tracking/session.jsonl` — tool events (автоматически, через hook)

### шаг 5 — проверь результат локально

после финала Claude покажет preview перед submit. **не отправляй** при локальном тесте:
```
отправить? [y/n] n
```

файлы остаются в `outputs/` и `tracking/`. открой их и посмотри, что получилось:
```bash
ls outputs/ tracking/
cat outputs/scores.json | jq .
wc -l tracking/session.jsonl
```

---

## method 2 — от лица кандидата (когда deploy будет готов)

**⚠ сейчас не работает** — `apply.aimindset.org` DNS не настроен, Netlify не задеплоен. инструкция ниже — как это будет после deploy.

```bash
bash <(curl -s https://apply.aimindset.org/go) marketing
```

одна команда: скачивает репо в `~/aim-apply`, запускает `claude` с правильным initial prompt, auto-starts assessment.

---

## method 3 — для кандидатов, которые хотят подать **как код** (experimental)

это **экспериментальный путь** для AI-native-fluent людей: вместо прохождения terminal-сессии можно отправить свой Claude Code skill / plugin / workflow как Pull Request.

### зачем

если ты уже строишь продвинутые workflows с Claude Code — пройти стандартный 25-минутный flow может быть скучно. лучше покажи, **как ты реально работаешь**.

### как

1. **fork** репо `ai-mindset-org/aim-apply`
2. создай папку `candidates/[your-name]/` в своём форке
3. положи туда:
   - `README.md` — кто ты, что показываешь, почему это отвечает на нашу вакансию
   - `skill/` или `plugin/` или `workflow/` — твой артефакт (Claude Code skill с `SKILL.md`, или plugin, или шаг-за-шагом описание пайплайна)
   - опционально: `demo.mp4` / `demo.gif` / ссылки на Loom
4. открой **Pull Request** в `ai-mindset-org/aim-apply`
5. в описании PR — укажи ссылку на вакансию, которой он соответствует
6. мы ответим комментарием в PR в течение 3 дней

### что мы ищем в таком PR

- **skill что-то делает, а не просто описывает** — есть исполняемый код, не только markdown
- **связь с реальной задачей** — скилл решает проблему, которая возникла бы в нашей работе
- **читаемость** — мы можем понять, что это делает, не разбираясь 30 минут
- **AI-nativeness** — использует Claude Code / MCP / subagents / hooks, а не просто вызывает API один раз

### NB

PR flow — **не замена** terminal flow, это альтернатива для специфического типа кандидатов. если не уверен, что подходит — просто пройди terminal flow.

---

## что делать, если что-то пошло не так

### проблема: `claude` command not found
```bash
npm install -g @anthropic-ai/claude-code
# или brew install anthropic/tap/claude-code
```

### проблема: Claude Code ничего не делает после запуска
скорее всего initial prompt не передан. запускай **с аргументом**:
```bash
claude "начни assessment — прочитай CLAUDE.md и покажи welcome"
```
**не** просто `claude`.

### проблема: "PostToolUse hook failed" или похожее
hooks в `.claude/settings.json` могут конфликтовать с твоим окружением. можно временно отключить для теста:
```bash
mv .claude/settings.json .claude/settings.json.bak
```
после теста вернёшь обратно.

### проблема: Claude читает файлы до welcome
баг в auto-start logic. проверь, что `CLAUDE.md` начинается с раздела `## CRITICAL: auto-start` — если нет, это не v2 версия.

### проблема: я застрял в середине фазы
просто скажи Claude: "пропусти это задание" или "давай дальше". он умеет гибко переключаться между фазами.

---

## что мы хотим услышать после тестирования

если ты тестировал flow — напиши нам **одним сообщением** в [@ai_mind_set_team](https://t.me/ai_mind_set_team):

1. что **понравилось** (одна строка)
2. что **сломалось** (одна строка, конкретика — где именно)
3. что бы ты **изменил** (одна идея)

это критически важный feedback — flow будет дорабатываться на основе реальных прохождений.

---

## feedback loop для команды AI Mindset

после прохождения локального теста — запусти:
```bash
tail -20 tracking/session.jsonl
cat outputs/scores.json
```

обрати внимание на:
- **session.jsonl** — какие tools Claude реально использовал, сколько раз, какое timing
- **scores.json** — какие axes получили высокий/низкий балл и почему
- **outputs/** — качество артефактов, которые ты сам создал (если тестируешь как кандидат)

эти данные — основа для итераций на scoring rubric и для тюнинга заданий.

---

*последнее обновление: 2026-04-10*
