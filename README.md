<div align="center">

<br>

# /apply

### это не вакансия. это proof of how you work.

<img width="2052" height="558" alt="CleanShot 2026-04-08 at 00 06 29@2x" src="https://github.com/user-attachments/assets/bb6aac52-a2ac-44e1-ad28-af7386223fd2" />


<br>

[![GitHub Pages](https://img.shields.io/badge/landing-apply-4dc9d4?style=flat-square)](https://ai-mindset-org.github.io/aim-apply/)
[![License: MIT](https://img.shields.io/badge/license-MIT-white?style=flat-square)](LICENSE)

<br>

</div>

---


## философия

нам не важно, кто ты был до этого.

не важно, маркетолог ты, разработчик или дизайнер.

важно – ты живёшь в AI-инструментах и хочешь строить будущее.

это не вакансия. это proof of how you work.

---

## что это

терминальный assessment для **[AI Mindset](https://ai-mindset-org.github.io/aim-apply/)** – 25 минут, 4 задания, Claude Code.

не резюме. не сопроводительное. просто терминальная сессия.
мы смотрим **как ты работаешь**, а не что ты знаешь.

---

## про AI Mindset

AI-образование и трансформация. учим людей и компании работать с AI как с операционной системой, а не как с чатом.

- **~1000 выпускников** лабораторий
- **~10K подписчиков** на разных площадках
- **Space** – сообщество для фаундеров
- **Labs** – интенсивы AI-трансформации
- **Sprints** – 90-дневные программы AI-native организаций
- **B2B** – корпоративная AI-трансформация

**stack:** Obsidian (12K docs), Linear, Claude Code (100+ skills), Telegram, MCP

команда 8 человек. remote, async-first.

---

## направления

| направление | что делает |
|-------------|-----------|
| **content & growth** | стратегия, копирайтинг, TG-канал, ads, аналитика |
| **automation & systems** | skills, hooks, MCP, dashboards, автоматизации |
| **visual & creative** | карусели, баннеры, HTML/SVG, видео |
| **management & operations** | процессы, Linear, координация, отчёты |
| **community & support** | чаты, онбординг, фидбэк, events |
| **mix** | любое сочетание |

даже 30% пересечения = ок. главное – **ты живёшь в AI-инструментах каждый день**.

подробнее: [`context/role.md`](context/role.md)

---

## как пройти

```bash
git clone https://github.com/ai-mindset-org/aim-apply.git
cd aim-apply
claude
```

Claude проведёт тебя через 4 задания. всё автоматически.

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

## задания

| # | что | время | output |
|---|-----|-------|--------|
| 01 | представься + выбери направление | 3 мин | `outputs/profile.md` |
| 02 | исследуй AIM + построй knowledge wiki | 7 мин | `outputs/wiki/` |
| 03 | создай артефакт (по направлению) | 10 мин | `outputs/` |
| 04 | рефлексия | 5 мин | `outputs/reflection.md` |

---

## требования

- **[Claude Code](https://docs.anthropic.com/en/docs/claude-code)** установлен: `npm install -g @anthropic-ai/claude-code`
- **git**
- **~25 минут** фокусного времени
- любопытство

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

<div align="center">

*built by agents, for agents*

[**apply.aimindset.org**](https://ai-mindset-org.github.io/aim-apply/)

</div>
