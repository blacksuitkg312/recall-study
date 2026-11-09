/* ==========================================================================
   views/progress.js — stats, streak, activity, mastery
   ========================================================================== */

import { store } from '../db.js';
import { icon } from '../icons.js';
import { esc, dateKey, plural, clamp } from '../utils.js';
import { renderHeader, bindHeader, emptyState } from '../components.js';
import { setMastery } from '../srs.js';

export function renderProgress() {
  const state = store.getState();
  const stats = store.stats();
  const goal = state.settings.dailyGoal;
  const goalPct = clamp(Math.round((stats.studiedToday / goal) * 100), 0, 100);

  const history = state.activity.history || {};
  const days = lastNDays(14).map((key) => ({
    key,
    count: history[key] || 0,
  }));
  const maxCount = Math.max(goal, ...days.map((d) => d.count), 1);

  const sets = [...state.sets].sort((a, b) => setMastery(b.cards) - setMastery(a.cards));

  return `
    ${renderHeader('progress')}
    <main class="page">
      <div class="container">
        <div class="section-head">
          <div>
            <h1>Your progress</h1>
            <p>A quick look at your study habits and what's sticking.</p>
          </div>
          <button class="btn btn--outline btn--sm" id="goal-btn">${icon('target')} Daily goal: ${goal}</button>
        </div>

        <div class="stat-grid" style="grid-template-columns:repeat(4,1fr);margin-bottom:24px">
          ${bigStat('Total XP', stats.xp, 'zap', 'earned from reviews')}
          ${bigStat('Day streak', stats.streak, 'flame', stats.streak ? 'keep it alive' : 'study to start')}
          ${bigStat('Studied today', stats.studiedToday, 'target', `${goalPct}% of goal`)}
          ${bigStat('Cards due', stats.due, 'clock', stats.due ? 'ready to review' : 'all caught up')}
        </div>

        <section class="card" style="padding:24px;margin-bottom:24px">
          <div class="row" style="justify-content:space-between;margin-bottom:18px">
            <div>
              <h2 style="font-size:18px">Last 14 days</h2>
              <p class="muted" style="font-size:13px">Cards reviewed per day</p>
            </div>
            <span class="chip chip--brand">${icon('flame')} ${stats.streak} day streak</span>
          </div>
          <div style="display:flex;align-items:flex-end;gap:8px;height:160px">
            ${days
              .map((d) => {
                const h = Math.max(4, Math.round((d.count / maxCount) * 140));
                const isToday = d.key === dateKey();
                return `
                  <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:6px" title="${d.count} on ${d.key}">
                    <div style="width:100%;height:${h}px;border-radius:8px 8px 4px 4px;
                      background:${d.count ? 'linear-gradient(180deg,var(--brand),#a855f7)' : 'var(--surface-3)'};
                      opacity:${d.count ? 1 : 0.5};transition:height .4s ease"></div>
                    <span style="font-size:10px;color:var(--text-faint);font-weight:${isToday ? 800 : 600}">
                      ${isToday ? 'Today' : weekdayShort(d.key)}
                    </span>
                  </div>`;
              })
              .join('')}
          </div>
        </section>

        <div class="section-head">
          <div>
            <h2 style="font-size:18px">Mastery by set</h2>
            <p>Estimated from your review history across all cards.</p>
          </div>
        </div>

        ${
          sets.length
            ? `<div class="card" style="padding:8px 20px">
                ${sets
                  .map((set) => {
                    const m = setMastery(set.cards);
                    return `
                      <div style="display:flex;align-items:center;gap:16px;padding:16px 0;border-bottom:1px solid var(--border)">
                        <span style="width:8px;height:8px;border-radius:50%;background:${set.accent};flex:none"></span>
                        <a href="#/set/${set.id}" style="flex:1;min-width:0">
                          <div style="font-weight:650;font-size:14px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(set.title)}</div>
                          <div class="faint" style="font-size:12px">${plural(set.cards.length, 'card')}</div>
                        </a>
                        <div style="width:160px;flex:none" class="progress ${m >= 70 ? 'progress--success' : ''}">
                          <div class="progress__fill" style="width:${m}%"></div>
                        </div>
                        <span style="width:44px;text-align:right;font-weight:700;font-size:13px">${m}%</span>
                      </div>`;
                  })
                  .join('')}
              </div>`
            : emptyState({
                iconName: 'target',
                title: 'No data yet',
                text: 'Create a set and study it to see your mastery here.',
                action: `<a href="#/new" class="btn btn--primary">${icon('plus')} Create a set</a>`,
              })
        }
      </div>
    </main>
  `;
}

function bigStat(label, value, iconName, hint) {
  return `
    <div class="stat">
      <span class="stat__label">${esc(label)}</span>
      <span class="stat__value"><span class="spark" style="color:var(--brand)">${icon(iconName)}</span>${value}</span>
      <span class="stat__hint">${esc(hint)}</span>
    </div>
  `;
}

function lastNDays(n) {
  const out = [];
  const today = new Date();
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(today);
    d.setDate(today.getDate() - i);
    out.push(dateKey(d));
  }
  return out;
}

function weekdayShort(key) {
  const d = new Date(key + 'T00:00:00');
  return d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 2);
}

export function mountProgress() {
  bindHeader();
  document.getElementById('goal-btn')?.addEventListener('click', () => {
    import('../components.js').then(({ openModal, closeModal, toast }) => {
      const current = store.getState().settings.dailyGoal;
      openModal({
        title: 'Daily goal',
        body: `
          <p>How many cards do you want to review each day?</p>
          <input class="input" id="goal-input" type="number" min="1" max="500" value="${current}" />
        `,
        actions: [
          { label: 'Cancel', className: 'btn--ghost', onClick: closeModal },
          {
            label: 'Save',
            className: 'btn--primary',
            onClick: () => {
              const val = Number(document.getElementById('goal-input')?.value);
              store.setDailyGoal(val);
              closeModal();
              toast('Daily goal updated', 'success');
              window.dispatchEvent(new HashChangeEvent('hashchange'));
            },
          },
        ],
        onMount: (modal) => modal.querySelector('#goal-input')?.select(),
      });
    });
  });
}
