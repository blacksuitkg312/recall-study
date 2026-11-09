/* ==========================================================================
   views/set.js — set detail (study modes + term list)
   ========================================================================== */

import { store } from '../db.js';
import { icon } from '../icons.js';
import { esc, plural, timeAgo } from '../utils.js';
import { renderHeader, bindHeader, confirmDialog, toast } from '../components.js';
import { setMastery, cardMastery, dueLabel, isDue } from '../srs.js';

const MODES = [
  { id: 'flashcards', name: 'Flashcards', icon: 'layers', desc: 'Flip through cards at your own pace.' },
  { id: 'learn', name: 'Learn', icon: 'brain', desc: 'Adaptive questions scheduled by recall.' },
  { id: 'test', name: 'Test', icon: 'clipboard', desc: 'Mixed-format quiz with a score.' },
  { id: 'match', name: 'Match', icon: 'grid', desc: 'Race the clock to pair terms.' },
];

export function renderSet({ id }) {
  const set = store.getSet(id);
  if (!set) {
    return notFound();
  }
  const mastery = setMastery(set.cards);
  const now = Date.now();
  const due = set.cards.filter((c) => isDue(c.srs, now)).length;
  const learned = set.cards.filter((c) => c.srs && c.srs.reps > 0).length;

  return `
    ${renderHeader()}
    <main class="page">
      <div class="container">
        <div class="crumbs">
          <a href="#/">Library</a> ${icon('chevronRight')} <span>${esc(set.title)}</span>
        </div>

        <section class="set-hero">
          <div class="set-hero__main">
            <h1>${esc(set.title)}</h1>
            <p class="set-hero__desc">${esc(set.description || 'No description yet.')}</p>
            <div class="set-hero__meta">
              <span class="chip">${icon('cards')} ${plural(set.cards.length, 'card')}</span>
              <span class="chip ${due ? 'chip--warning' : 'chip--success'}">
                ${icon('clock')} ${due ? `${due} due` : 'All caught up'}
              </span>
              <span class="chip">${icon('checkCircle')} ${learned} learned</span>
              <span class="chip">${icon('edit')} edited ${timeAgo(set.updatedAt)}</span>
            </div>
          </div>
          <div class="set-hero__actions">
            <a href="#/edit/${set.id}" class="btn btn--outline">${icon('edit')} Edit</a>
            <button class="btn btn--outline iconbtn-only" id="more-btn" title="More actions">${icon('settings')}</button>
          </div>
        </section>

        <section class="mode-grid">
          ${MODES.map((m) => modeCard(m, set, due)).join('')}
        </section>

        <div class="section-head">
          <div>
            <h2 style="font-size:20px">Terms in this set (${set.cards.length})</h2>
            <p>Mastery is estimated from your review history.</p>
          </div>
        </div>

        ${
          set.cards.length
            ? `<div class="terms">
                ${set.cards
                  .map(
                    (c, i) => `
                  <div class="term-row">
                    <span class="term-row__num">${i + 1}</span>
                    <span class="term-row__term">${esc(c.term || '—')}</span>
                    <span class="term-row__def">${esc(c.definition || '—')}</span>
                    <span class="term-row__actions">
                      <span class="chip ${cardMastery(c.srs) >= 70 ? 'chip--success' : ''}" title="Mastery">${cardMastery(c.srs)}%</span>
                      <span class="chip" title="Next review">${dueLabel(c.srs)}</span>
                    </span>
                  </div>`
                  )
                  .join('')}
              </div>`
            : `<div class="empty">
                <div class="empty__icon">${icon('plus')}</div>
                <h3>No cards yet</h3>
                <p>Add terms and definitions to start studying.</p>
                <a href="#/edit/${set.id}" class="btn btn--primary">${icon('edit')} Add cards</a>
              </div>`
        }
      </div>
    </main>
  `;
}

function modeCard(mode, set, due) {
  const disabled = set.cards.length < 2;
  const badge =
    mode.id === 'learn' && due > 0
      ? `${due} due`
      : mode.id === 'flashcards'
      ? `${set.cards.length} cards`
      : '';
  if (disabled) {
    return `
      <div class="mode-card" style="opacity:.5;cursor:not-allowed" title="Add at least 2 cards">
        <div class="mode-card__icon">${icon(mode.icon)}</div>
        <h3>${mode.name}</h3>
        <p>${mode.desc}</p>
      </div>`;
  }
  return `
    <a class="mode-card" href="#/study/${set.id}/${mode.id}">
      <div class="mode-card__icon">${icon(mode.icon)}</div>
      <h3>${mode.name}</h3>
      <p>${mode.desc}</p>
      ${badge ? `<span class="mode-card__count">${badge}</span>` : ''}
    </a>
  `;
}

function notFound() {
  return `
    ${renderHeader()}
    <main class="page"><div class="container">
      <div class="empty">
        <div class="empty__icon">${icon('xCircle')}</div>
        <h3>Set not found</h3>
        <p>It may have been deleted.</p>
        <a href="#/" class="btn btn--primary">Back to library</a>
      </div>
    </div></main>`;
}

export function mountSet({ id }) {
  bindHeader();
  const set = store.getSet(id);
  if (!set) return;

  document.getElementById('more-btn')?.addEventListener('click', () => {
    import('../components.js').then(({ openModal, closeModal }) => {
      openModal({
        title: 'Set options',
        body: `<p>Manage “${esc(set.title)}”.</p>`,
        actions: [
          {
            label: 'Duplicate',
            className: 'btn--outline',
            onClick: () => {
              const copy = store.duplicateSet(set.id);
              closeModal();
              if (copy) {
                toast('Set duplicated', 'success');
                location.hash = `#/set/${copy.id}`;
              }
            },
          },
          {
            label: 'Export',
            className: 'btn--outline',
            onClick: () => {
              const data = JSON.stringify(set, null, 2);
              const blob = new Blob([data], { type: 'application/json' });
              const url = URL.createObjectURL(blob);
              const a = document.createElement('a');
              a.href = url;
              a.download = `${set.title.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}.json`;
              a.click();
              URL.revokeObjectURL(url);
              closeModal();
            },
          },
          {
            label: 'Delete',
            className: 'btn--danger',
            onClick: async () => {
              closeModal();
              const ok = await confirmDialog({
                title: 'Delete this set?',
                message: `“${set.title}” and its ${set.cards.length} cards will be permanently removed.`,
                confirmLabel: 'Delete set',
                danger: true,
              });
              if (ok) {
                store.deleteSet(set.id);
                toast('Set deleted', 'success');
                location.hash = '#/';
              }
            },
          },
        ],
      });
    });
  });
}
