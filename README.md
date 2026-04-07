<div align="center">

<br>

# /apply

### последняя вакансия, на которую ты подашься

<br>

[![GitHub Pages](https://img.shields.io/badge/landing-apply-4dc9d4?style=flat-square)](https://ai-mindset-org.github.io/aim-apply/)
[![License: MIT](https://img.shields.io/badge/license-MIT-white?style=flat-square)](LICENSE)

<br>

</div>

---

## что это

терминальный assessment для **[AI Mindset](https://ai-mindset-org.github.io/aim-apply/)** – 25 минут, 4 задания, Claude Code.

не резюме. не сопроводительное. просто терминальная сессия.
мы смотрим **как ты работаешь**, а не что ты знаешь.

---

## кого ищем

**AI Native Operator** – человек, который живёт в AI-инструментах и строит системы.

не маркетолог. не разработчик. не дизайнер. **все сразу** – в любой пропорции.

| направление | что делает |
|-------------|-----------|
| **marketing** | контент-стратегия, копирайтинг, TG-канал, ads |
| **dev** | skills, hooks, MCP, dashboards, автоматизации |
| **design** | карусели, баннеры, HTML/SVG, видео |
| **ops** | процессы, Linear, синхронизация, отчёты |
| **mix** | любое сочетание |

даже 30% пересечения = ок. главное – **ты живёшь в AI-инструментах каждый день**.

подробнее: [`context/role.md`](context/role.md)

---

## как это работает

### 1. clone

```bash
git clone https://github.com/ai-mindset-org/aim-apply.git
cd aim-apply
```

### 2. claude code

```bash
claude
```

Claude проведёт тебя через 4 задания (~25 мин). tool usage логируется автоматически – это часть оценки.

### 3. submit

когда закончишь – GitHub подскажет, как отправить результат. варианты:
- **fork + PR** – классический flow
- **Use this template** – создать свой репо из шаблона
- **zip outputs/** – если не хочешь возиться с git

---

## что оценивается

```
                    Technical  Thinking  Taste   Initiative
                    Skill      Logic     Design
─────────────────────────────────────────────────────────────
01 introduce        –          –         –       ✓
02 research+wiki    ✓          ✓         ✓       ✓
03 create           ✓          ✓         ✓       ✓
04 reflect          –          ✓         ✓       ✓
```

- **Technical Skill** – терминал, git, агенты, файловая система
- **Thinking/Logic** – синтез, структурирование, приоритизация
- **Taste/Design** – эстетика и качество output
- **Initiative** – делаешь больше, чем попросили

---

## требования

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** установлен: `npm install -g @anthropic-ai/claude-code`
- **git**
- **~25 минут** фокусного времени
- любопытство

---

## задания

| # | что | время | output |
|---|-----|-------|--------|
| 01 | представься + выбери направление | 3 мин | `outputs/profile.md` |
| 02 | исследуй AIM + построй knowledge wiki | 7 мин | `outputs/wiki/` |
| 03 | создай артефакт (по направлению) | 10 мин | `outputs/` |
| 04 | рефлексия | 5 мин | `outputs/reflection.md` |

---

## структура репо

```
aim-apply/
├── CLAUDE.md              ← assessment engine
├── context/               ← об AI Mindset, продуктах, роли
├── tasks/                 ← 4 задания
├── outputs/               ← ты заполняешь
├── tracking/              ← авто-логирование (hooks)
├── scripts/               ← tracking scripts
├── .claude/settings.json  ← hooks config
└── docs/                  ← landing page
```

---

## про AI Mindset

команда из 8 человек. remote, async-first.

- **Space** – 5K+ подписчиков
- **Labs** – интенсивы AI-трансформации для фаундеров
- **Sprints** – 90-дневные программы AI-native организаций
- **B2B** – корпоративная AI-трансформация

100+ Claude Code скиллов. Obsidian vault на 12K документов. Linear. Telegram. всё через агентов.

---

<div align="center">

*built by agents, for agents*

[**apply.aimindset.org**](https://ai-mindset-org.github.io/aim-apply/)

</div>
