/* ==========================================================================
   views/dashboard.js — library home
   ========================================================================== */

import { store } from '../db.js';
import { icon } from '../icons.js';
import { esc, plural, timeAgo } from '../utils.js';
import { renderHeader, bindHeader, emptyState, toast } from '../components.js';
import { setMastery } from '../srs.js';
import { SAMPLE_SETS } from '../sample.js';

export function renderDashboard() {
  const { sets } = store.getState();
  const stats = store.stats();
  const goal = store.getState().settings.dailyGoal;
  const goalPct = Math.min(100, Math.round((stats.studiedToday / goal) * 100));

  return `
    ${renderHeader('home')}
    <main class="page">
      <div class="container">
        <section class="hero">
          <div class="hero__main">
            <div class="hero__eyebrow">${greeting()}</div>
            <h1 class="hero__title">Remember more in less time.</h1>
            <p class="hero__sub">
              ${
                stats.due > 0
                  ? `You have <strong>${plural(stats.due, 'card')}</strong> due for review. A few focused minutes goes a long way.`
                  : 'Everything is reviewed for now. Add a set or get ahead on something new.'
              }
            </p>
            <div class="hero__actions">
              ${
                stats.due > 0
                  ? `<a href="#/due" class="btn btn--primary btn--lg">${icon('zap')} Review due cards</a>`
                  : ''
              }
              <a href="#/new" class="btn ${stats.due > 0 ? 'btn--ghost' : 'btn--primary'} btn--lg">
                ${icon('plus')} Create a set
              </a>
            </div>
          </div>

          <div class="stat-grid">
            ${statCard('Due now', stats.due, 'clock', stats.due > 0 ? 'Ready to review' : 'All caught up')}
            ${statCard('Studied today', `${stats.studiedToday}<span class="faint" style="font-size:14px;font-weight:600">/${goal}</span>`, 'target', `${goalPct}% of daily goal`)}
            ${statCard('Day streak', stats.streak, 'flame', stats.streak > 0 ? 'Keep it going' : 'Start today')}
            ${statCard('Total cards', stats.cards, 'cards', plural(stats.sets, 'set'))}
          </div>
        </section>

        <div class="toolbar">
          <div class="search">
            ${icon('search')}
            <input type="search" id="set-search" placeholder="Search your sets…" autocomplete="off" />
          </div>
          <div class="header__spacer"></div>
          <button class="btn btn--outline btn--sm" id="import-btn">${icon('upload')} Import</button>
          <button class="btn btn--outline btn--sm" id="export-btn">${icon('download')} Export</button>
          <input type="file" id="import-file" accept="application/json,.json" class="hidden" />
        </div>

        <div id="set-list">
          ${
            sets.length
              ? `<div class="grid-sets">${sets.map(setCard).join('')}</div>`
              : emptyState({
                  iconName: 'layers',
                  title: 'Your library is empty',
                  text: 'Create your first study set, import one from a JSON file, or try a ready-made sample. Everything stays on your device.',
                  action: `
                    <div class="row gap-8" style="justify-content:center;flex-wrap:wrap">
                      <a href="#/new" class="btn btn--primary">${icon('plus')} Create your first set</a>
                      <button class="btn btn--outline" id="sample-btn">${icon('sparkles')} Try a sample set</button>
                    </div>`,
                })
          }
        </div>
      </div>
    </main>
  `;
}

function statCard(label, value, iconName, hint) {
  return `
    <div class="stat">
      <span class="stat__label">${esc(label)}</span>
      <span class="stat__value">${value}</span>
      <span class="stat__hint">${esc(hint)}</span>
    </div>
  `;
}

function setCard(set) {
  const mastery = setMastery(set.cards);
  const due = set.cards.filter((c) => !c.srs || c.srs.due <= Date.now()).length;
  return `
    <article class="set-card" style="--accent:${set.accent}" data-set-id="${set.id}">
      <a href="#/set/${set.id}" class="set-card__top" style="color:inherit">
        <h3 class="set-card__title">${esc(set.title)}</h3>
        <span class="chip">${icon('cards')} ${set.cards.length}</span>
      </a>
      <p class="set-card__desc">${esc(set.description || 'No description')}</p>
      <div class="set-card__meta">
        <span class="chip ${mastery >= 70 ? 'chip--success' : mastery > 0 ? 'chip--brand' : ''}">
          ${icon('target')} ${mastery}% mastered
        </span>
        ${due > 0 ? `<span class="chip chip--warning">${icon('clock')} ${due} due</span>` : `<span class="chip chip--success">${icon('check')} Caught up</span>`}
      </div>
      <div class="set-card__footer">
        <a href="#/study/${set.id}/flashcards" class="btn btn--soft btn--sm">${icon('play')} Study</a>
        <a href="#/set/${set.id}" class="btn btn--outline btn--sm">Open</a>
      </div>
    </article>
  `;
}

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 18) return 'Good afternoon';
  return 'Good evening';
}

export function mountDashboard() {
  bindHeader();

  document.getElementById('sample-btn')?.addEventListener('click', () => {
    SAMPLE_SETS.forEach((s) => store.createSet(s));
    toast('Sample sets added', 'success');
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  });

  const search = document.getElementById('set-search');
  const list = document.getElementById('set-list');
  if (search && list) {
    search.addEventListener('input', () => {
      const q = search.value.trim().toLowerCase();
      const sets = store.getState().sets;
      const filtered = q
        ? sets.filter(
            (s) =>
              s.title.toLowerCase().includes(q) ||
              s.description.toLowerCase().includes(q) ||
              s.cards.some(
                (c) =>
                  c.term.toLowerCase().includes(q) ||
                  c.definition.toLowerCase().includes(q)
              )
          )
        : sets;
      list.innerHTML = filtered.length
        ? `<div class="grid-sets">${filtered.map(setCard).join('')}</div>`
        : `<p class="muted center" style="padding:40px">No sets match “${esc(search.value)}”.</p>`;
    });
  }

  document.getElementById('export-btn')?.addEventListener('click', () => {
    const blob = new Blob([store.exportData()], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `recall-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  });

  const fileInput = document.getElementById('import-file');
  document.getElementById('import-btn')?.addEventListener('click', () => fileInput?.click());
  fileInput?.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const text = await file.text();
      const result = store.importData(text);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      toast(`Imported ${plural(result.sets, 'set')}`, 'success');
    } catch (err) {
      toast('Import failed: ' + err.message, 'danger');
    }
    fileInput.value = '';
  });
}
