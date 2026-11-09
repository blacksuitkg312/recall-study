/* ==========================================================================
   components.js — shared UI building blocks
   ========================================================================== */

import { icon } from './icons.js';
import { esc } from './utils.js';
import { store } from './db.js';

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

export function openModal({ title, body, actions = [], onMount }) {
  const root = document.getElementById('modal-root');
  if (!root) return;
  root.innerHTML = `
    <div class="modal-backdrop" data-close>
      <div class="modal" role="dialog" aria-modal="true">
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
