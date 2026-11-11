# Recall

A faster, ad-free, **local-first** flashcard app with real spaced repetition.

Recall is a from-scratch take on Quizlet that focuses on the thing that actually
matters — remembering what you study — without ads, paywalls, or sign-ups.

```
┌──────────────────────────────────────────────────────────────┐
│  Library → Set → Study (Flashcards · Learn · Test · Match)    │
│                                                              │
│  Everything is stored on your device. Works fully offline.   │
└──────────────────────────────────────────────────────────────┘
```

## Why it's better than Quizlet

| | Recall | Typical flashcard sites |
|---|---|---|
| Ads / upsells | None | Frequent |
| Account required | No | Usually |
| Works offline | Yes | Limited |
| Scheduling | SM-2 spaced repetition | Basic modes |
| Data ownership | Yours, exportable JSON | Locked in |
| Setup | Zero dependencies | Account + app |

## Quick start

No install, no build step, no dependencies.

```bash
npm start
# then open http://localhost:4173
```

Or run the server directly:

```bash
node server.js 4173
```

> Use the local server rather than opening `index.html` directly — browsers block
> ES modules loaded from `file://` for security reasons.

On first launch you can click **Try a sample set** to load two ready-made decks.

## Features

### Sets and cards
- Create, edit, duplicate, and delete study sets.
- Rich card editor with term/definition sides.
- **Paste list** importer — paste from a spreadsheet or a `term - definition`
  list and it becomes cards.
- Import/export the whole library (or a single set) as JSON.
- Full-text search across set titles, descriptions, and cards.

### Pronunciation
- One-click **speaker buttons** on every term, study card, and translation.
- Uses the browser's built-in Web Speech API — no account, network request, or API key.
- Choose the pronunciation language in **Settings**.

### Edit or delete while studying
- Every study card has inline **pronounce / word info / edit / delete** controls.
- Fix a typo or remove a bad card without ending the session.
- The same tools are available on each row of the set's term list.

### Word info from the internet
- **Translations** grouped by part of speech, with a primary suggestion and
  clickable alternatives (Google Translate, with a MyMemory fallback).
- **Definitions** and examples from Wiktionary.
- **About** summaries and lead images from Wikipedia.
- **Pictures** from Wikimedia Commons.
- From/To language pickers and a swap button inside the panel.
- Results are cached locally for a week; turn lookups off in **Settings** to stay
  fully offline.

### Four study modes
- **Flashcards** — flip, navigate, shuffle, and self-rate with SRS ratings.
- **Learn** — adaptive multiple choice that re-queues anything you miss, walks
  new cards through short learning steps, and schedules each card based on
  your answer.
- **Test** — a mixed quiz of multiple choice, typed answers, and true/false,
  scored at the end. Practice only: it does not change due dates.
- **Match** — a timed matching game that reinforces term/definition pairs.
  Also practice only.

### Smarter scheduling
Each card tracks its own ease factor, interval, and due date using an SM-2
style algorithm. When you study, Recall surfaces the cards you're about to
forget — not the ones you already know.

- **Learning steps** — new cards move through 1-minute and 10-minute steps
  before graduating to day-based reviews. A missed review card goes back to
  the first learning step.
- **Priority queue** — overdue cards come first, with extra weight for cards
  that have lapsed, have low ease, or are flagged as leeches.
- **Daily limits** — separate caps for new cards and reviews (20 and 200 by
  default, configurable in Settings). When a cap is reached, a "Study ahead"
  link lets you continue deliberately.
- **Fuzzed intervals** — intervals of 3+ days get ±5% jitter so cards do not
  all become due on the same day, with a one-year maximum.
- **Leech detection** — a card that lapses 8 times is flagged in the set list
  and in study. Rewriting it clears the flag.

Ratings map to SM-2 quality:

| Rating | Meaning | Effect |
|---|---|---|
| Again | Missed it | Relearn from the first step, ease drops |
| Hard | Barely | Repeat the current learning step / shorter interval |
| Good | Got it | Advance a learning step or use the standard interval |
| Easy | Trivial | Skip learning steps / longer interval |

### Progress and motivation
- Per-card and per-set **mastery** estimates.
- Daily goal, XP, and a **day streak**.
- 14-day activity chart on the Progress page.
- "Due now" review queue across your whole library.

### Nice details
- Light/dark theme, remembered between visits.
- Keyboard shortcuts (below).
- Responsive layout for phone and desktop.
- Reduced-motion support.

## Keyboard shortcuts

**Flashcards**
- `Space` / `Enter` — flip, then advance
- `←` / `→` — previous / next
- `1` `2` `3` `4` — Again / Hard / Good / Easy (when flipped)

**Learn**
- `1`–`4` — pick an answer
- `Enter` / `Space` — continue after feedback

**Editor**
- `Ctrl/Cmd + S` — save the set

## Data and privacy

- All data lives in your browser's `localStorage` under `recall.db.v1`.
- Your sets and review history are never sent to a server. There is no backend.
- **Word info** optionally sends only the term you are looking up to Wikipedia,
  Wiktionary, Wikimedia Commons, and Google Translate. Disable **Allow online
  lookups** in Settings to keep the app fully offline.
- Pronunciation uses the browser's local speech engine and needs no network.
- Use **Export** on the library page to back up everything as JSON.
- Clearing site data or your browser storage removes your sets — export first.

## Project structure

```
index.html              App shell
css/styles.css          Design tokens + all styles
js/
  app.js                Hash router and view mounting
  db.js                 Local-first store (localStorage) + pub/sub
  srs.js                SM-2 spaced-repetition scheduling
  utils.js              Helpers (shuffle, escaping, answer matching, dates)
  icons.js              Inline SVG icon set
  components.js         Header, toasts, modals, settings, empty states
  languages.js          Language metadata for speech + translation
  speech.js             Web Speech API pronunciation
  enrich.js             Keyless online lookups (Wikipedia, Wiktionary, Commons, Translate)
  cardtools.js          Inline pronounce / info / edit / delete controls
  cardeditor.js         Edit-or-delete card modal
  wordinfo.js           Rich word info panel
  sample.js             Starter decks
  views/
    dashboard.js        Library, search, import/export
    set.js              Set detail + study mode picker + term tools
    editor.js           Create/edit set and cards
    study.js            Flashcards / Learn / Test / Match engines
    progress.js         Stats, streak, activity chart, mastery
server.js               Zero-dependency static server
scripts/smoke.mjs       Headless end-to-end smoke test (CDP)
```

The app uses native ES modules and no framework. Routing is hash-based, so any
static host works.

## Testing

With the dev server running:

```bash
node scripts/smoke.mjs
```

This launches a headless Chrome/Edge, drives the real UI through the DevTools
Protocol, and checks 56 behaviors (sample decks, CRUD, all study modes, learning
steps, daily caps, study-ahead, editor save, export, progress, due review,
persistence, pronunciation buttons, in-session edit/delete, word info, and
settings). It also fails on any runtime console error.

## Roadmap ideas

- Optional cloud sync and cross-device accounts.
- Image cards and cloze deletion.
- FSRS scheduling as an alternative to SM-2.
- Import from CSV/Anki.
- Shareable set links.

## License

MIT
