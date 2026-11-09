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

### Four study modes
- **Flashcards** — flip, navigate, shuffle, and self-rate with SRS ratings.
- **Learn** — adaptive multiple choice that re-queues anything you miss and
  schedules each card based on your answer.
- **Test** — a mixed quiz of multiple choice, typed answers, and true/false,
  scored at the end.
- **Match** — a timed matching game that reinforces term/definition pairs.

### Smarter scheduling
Each card tracks its own ease factor, interval, and due date using an SM-2
style algorithm. When you study, Recall surfaces the cards you're about to
forget — not the ones you already know.

Ratings map to SM-2 quality:

| Rating | Meaning | Effect |
|---|---|---|
| Again | Missed it | Relearn soon, ease drops |
| Hard | Barely | Shorter interval |
| Good | Got it | Standard interval |
| Easy | Trivial | Longer interval |

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
- Nothing is sent to a server. There is no backend.
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
  components.js         Header, toasts, modals, empty states
  sample.js             Starter decks
  views/
    dashboard.js        Library, search, import/export
    set.js              Set detail + study mode picker
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
Protocol, and checks 23 behaviors (sample decks, CRUD, all study modes, editor
save, export, progress, due review, persistence). It also fails on any runtime
console error.

## Roadmap ideas

- Optional cloud sync and cross-device accounts.
- Audio pronunciation for language cards.
- Image cards and cloze deletion.
- FSRS scheduling as an alternative to SM-2.
- Import from CSV/Anki.
- Shareable set links.

## License

MIT
