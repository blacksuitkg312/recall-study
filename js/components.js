/* ==========================================================================
   components.js — shared UI building blocks
   ========================================================================== */

import { icon } from './icons.js';
import { esc } from './utils.js';
import { store } from './db.js';
import { languageOptions, speechForCode } from './languages.js';

/* ------------------------------- Header ------------------------------- */

export function renderHeader(active = '') {
  const theme = store.getState().settings.theme;
  return `
    <header class="header">
      <div class="header__inner">
        <a href="#/" class="brand" aria-label="Recall home">
          <span class="brand__logo">${icon('logo')}</span>
          <span>Recall<span class="brand__dot">.</span></span>
        </a>
        <nav class="header__nav">
          <a href="#/" class="navlink ${active === 'home' ? 'is-active' : ''}">Library</a>
          <a href="#/progress" class="navlink ${active === 'progress' ? 'is-active' : ''}">Progress</a>
        </nav>
        <div class="header__spacer"></div>
        <a href="#/new" class="btn btn--primary btn--sm">${icon('plus')} New set</a>
        <button class="iconbtn" id="settings-btn" title="Settings" aria-label="Settings">
          ${icon('settings')}
        </button>
        <button class="iconbtn" id="theme-toggle" title="Toggle theme" aria-label="Toggle theme">
          ${icon(theme === 'dark' ? 'sun' : 'moon')}
        </button>
      </div>
    </header>
  `;
}

export function bindHeader() {
  const btn = document.getElementById('theme-toggle');
  if (btn) {
    btn.addEventListener('click', () => {
      store.toggleTheme();
      btn.innerHTML = icon(store.getState().settings.theme === 'dark' ? 'sun' : 'moon');
    });
  }
  document.getElementById('settings-btn')?.addEventListener('click', openSettings);
}

/* -------------------------------- Toast ------------------------------- */

let toastTimer = null;

export function toast(message, type = 'info') {
  const root = document.getElementById('toast-root');
  if (!root) return;
  const el = document.createElement('div');
  el.className = `toast toast--${type}`;
  const iconName = type === 'success' ? 'checkCircle' : type === 'danger' ? 'xCircle' : 'info';
  el.innerHTML = `${icon(iconName)}<span>${esc(message)}</span>`;
  root.appendChild(el);
  setTimeout(() => {
    el.classList.add('is-leaving');
    setTimeout(() => el.remove(), 200);
  }, 2600);
}

/* -------------------------------- Modal ------------------------------- */

export function closeModal() {
  const root = document.getElementById('modal-root');
  if (root) root.innerHTML = '';
  document.body.style.overflow = '';
}

export function openModal({ title, body, actions = [], onMount, wide = false }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal ${wide ? 'modal--wide' : ''}" role="dialog" aria-modal="true">
        <h2>${esc(title)}</h2>
        <div class="modal__body">${body || ''}</div>
        <div class="modal__actions">
          ${actions
            .map(
              (a, i) =>
                `<button class="btn ${a.className || 'btn--outline'}" data-action="${i}">${esc(
                  a.label
                )}</button>`
            )
            .join('')}
        </div>
      </div>
    </div>
  `;
  document.body.style.overflow = 'hidden';

  const backdrop = root.querySelector('.modal-backdrop');
  backdrop.addEventListener('click', (e) => {
    if (e.target === backdrop) closeModal();
  });

  root.querySelectorAll('[data-action]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const action = actions[Number(btn.dataset.action)];
      if (action && action.onClick) action.onClick();
    });
  });

  if (onMount) onMount(root.querySelector('.modal'));
  return root;
}

/** Promise-based confirm dialog. */
export function confirmDialog({
  title = 'Are you sure?',
  message = '',
  confirmLabel = 'Confirm',
  danger = false,
} = {}) {
  return new Promise((resolve) => {
    openModal({
      title,
      body: `<p>${esc(message)}</p>`,
      actions: [
        { label: 'Cancel', className: 'btn--ghost', onClick: () => { closeModal(); resolve(false); } },
        {
          label: confirmLabel,
          className: danger ? 'btn--danger' : 'btn--primary',
          onClick: () => { closeModal(); resolve(true); },
        },
      ],
    });
  });
}

/* --------------------------- Progress ring ---------------------------- */

export function progressRing(percent, size = 64, stroke = 7) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const offset = c - (Math.min(100, Math.max(0, percent)) / 100) * c;
  return `
    <svg width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" style="transform:rotate(-90deg)">
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="var(--surface-3)" stroke-width="${stroke}" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" fill="none"
        stroke="var(--brand)" stroke-width="${stroke}" stroke-linecap="round"
        stroke-dasharray="${c}" stroke-dashoffset="${offset}"
        style="transition: stroke-dashoffset 0.5s ease" />
    </svg>
  `;
}

/* ---------------------------- Empty state ----------------------------- */

export function emptyState({ iconName = 'layers', title, text, action }) {
  return `
    <div class="empty">
      <div class="empty__icon">${icon(iconName)}</div>
      <h3>${esc(title)}</h3>
      <p>${esc(text)}</p>
      ${action || ''}
    </div>
  `;
}

/* ----------------------------- Settings ------------------------------- */

export function openSettings() {
  const s = store.getState().settings;
  const speechCode = (s.speechLang || 'en-US').split('-')[0];

  openModal({
    title: 'Settings',
    body: `
      <div class="field">
        <label for="st-theme">Theme</label>
        <select id="st-theme" class="input">
          <option value="light" ${s.theme !== 'dark' ? 'selected' : ''}>Light</option>
          <option value="dark" ${s.theme === 'dark' ? 'selected' : ''}>Dark</option>
        </select>
      </div>

      <div class="field">
        <label for="st-goal">Daily goal (cards)</label>
        <input id="st-goal" class="input" type="number" min="1" max="500" value="${s.dailyGoal}" />
      </div>

      <div class="row gap-8" style="align-items:flex-start">
        <div class="field" style="flex:1">
          <label for="st-new">New cards / day</label>
          <input id="st-new" class="input" type="number" min="0" max="200" value="${s.newPerDay ?? 20}" />
        </div>
        <div class="field" style="flex:1">
          <label for="st-reviews">Reviews / day</label>
          <input id="st-reviews" class="input" type="number" min="0" max="1000" value="${s.reviewsPerDay ?? 200}" />
        </div>
      </div>
      <p class="faint" style="font-size:12px;margin-top:-6px;margin-bottom:14px">
        Session caps keep reviews manageable. Set a limit to 0 to pause that queue.
      </p>

      <div class="field">
        <label for="st-speech">Pronunciation language</label>
        <select id="st-speech" class="input">${languageOptions(speechCode)}</select>
        <span class="faint" style="font-size:12px">Used by the speaker buttons across the app.</span>
      </div>

      <div class="row gap-8" style="align-items:flex-start">
        <div class="field" style="flex:1">
          <label for="st-source">Translate from</label>
          <select id="st-source" class="input">${languageOptions(s.sourceLang || 'en')}</select>
        </div>
        <div class="field" style="flex:1">
          <label for="st-target">Translate to</label>
          <select id="st-target" class="input">${languageOptions(s.targetLang || 'es')}</select>
        </div>
      </div>

      <label class="check">
        <input type="checkbox" id="st-online" ${s.onlineLookups !== false ? 'checked' : ''} />
        <span>Allow online lookups</span>
      </label>
      <p class="faint" style="font-size:12px;margin-top:6px">
        Word info sends the term to Wikipedia, Wiktionary, Wikimedia Commons and Google Translate.
        Your sets never leave this device.
      </p>
    `,
    actions: [
      { label: 'Cancel', className: 'btn--ghost', onClick: closeModal },
      {
        label: 'Save',
        className: 'btn--primary',
        onClick: () => {
          const theme = document.getElementById('st-theme')?.value || 'light';
          const dailyGoal = Number(document.getElementById('st-goal')?.value) || 20;
          const newRaw = document.getElementById('st-new')?.value;
          const reviewsRaw = document.getElementById('st-reviews')?.value;
          const newPerDay = newRaw === '' || newRaw == null ? 20 : Number(newRaw);
          const reviewsPerDay =
            reviewsRaw === '' || reviewsRaw == null ? 200 : Number(reviewsRaw);
          const speech = document.getElementById('st-speech')?.value || 'en';
          const sourceLang = document.getElementById('st-source')?.value || 'en';
          const targetLang = document.getElementById('st-target')?.value || 'es';
          const onlineLookups = !!document.getElementById('st-online')?.checked;

          store.updateSettings({
            theme,
            dailyGoal,
            newPerDay: Number.isFinite(newPerDay) ? newPerDay : 20,
            reviewsPerDay: Number.isFinite(reviewsPerDay) ? reviewsPerDay : 200,
            speechLang: speechForCode(speech),
            sourceLang,
            targetLang,
            onlineLookups,
          });
          closeModal();
          toast('Settings saved', 'success');
        },
      },
    ],
  });
}
