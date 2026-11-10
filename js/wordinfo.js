/* ==========================================================================
   wordinfo.js — rich online word panel (definitions, translations, images)
   ========================================================================== */

import { openModal, closeModal } from './components.js';
import { store } from './db.js';
import { icon } from './icons.js';
import { esc } from './utils.js';
import { lookup, lookupTranslations } from './enrich.js';
import { speak } from './speech.js';
import { languageOptions } from './languages.js';
import { openCardEditor } from './cardeditor.js';

export function openWordInfo({
  term,
  definition = '',
  card = null,
  onChanged,
  onDeleted,
} = {}) {
  const settings = store.getState().settings;
  let source = settings.sourceLang || 'en';
  let target = settings.targetLang || 'es';
  const online = settings.onlineLookups !== false;

  const body = `
    <div class="wi">
      <div class="wi-head">
        <div class="wi-head__text">
          <div class="wi-term">${esc(term)}</div>
          ${definition ? `<div class="wi-def muted">${esc(definition)}</div>` : ''}
        </div>
        <button class="btn btn--soft btn--sm" id="wi-speak">${icon('volume')} Pronounce</button>
      </div>

      <div class="wi-langs">
        <label class="wi-lang">From
          <select id="wi-from" class="input input--sm" ${online ? '' : 'disabled'}>${languageOptions(source)}</select>
        </label>
        <button class="iconbtn" id="wi-swap" title="Swap languages" aria-label="Swap languages" ${online ? '' : 'disabled'}>${icon('swap')}</button>
        <label class="wi-lang">To
          <select id="wi-to" class="input input--sm" ${online ? '' : 'disabled'}>${languageOptions(target)}</select>
        </label>
      </div>

      ${online ? '' : `<div class="wi-notice">${icon('info')} Online lookups are turned off. Turn them on in Settings to load definitions, translations and pictures.</div>`}

      <section class="wi-section">
        <h3>${icon('book')} About</h3>
        <div id="wi-summary" class="wi-body">${online ? skeleton() : ''}</div>
      </section>

      <section class="wi-section">
        <h3>${icon('clipboard')} Definitions</h3>
        <div id="wi-defs" class="wi-body">${online ? skeleton() : ''}</div>
      </section>

      <section class="wi-section">
        <h3>${icon('globe')} Translations</h3>
        <div id="wi-trans" class="wi-body">${online ? skeleton() : ''}</div>
      </section>

      <section class="wi-section">
        <h3>${icon('image')} Pictures</h3>
        <div id="wi-images" class="wi-body">${online ? skeleton() : ''}</div>
      </section>

      <p class="wi-attrib">
        Data from Wikipedia, Wiktionary, Wikimedia Commons and Google Translate.
        Machine translation may be imperfect.
      </p>
    </div>
  `;

  const actions = [
    ...(card
      ? [
          {
            label: 'Edit card',
            className: 'btn--outline',
            onClick: () => {
              closeModal();
              openCardEditor(card, { onSaved: onChanged, onDeleted });
            },
          },
        ]
      : []),
    { label: 'Close', className: 'btn--primary', onClick: closeModal },
  ];

  openModal({
    title: 'Word info',
    wide: true,
    body,
    actions,
    onMount: (modal) => {
      modal.querySelector('#wi-speak')?.addEventListener('click', () => {
        speak(term, source);
      });

      const fromSel = modal.querySelector('#wi-from');
      const toSel = modal.querySelector('#wi-to');
      const summaryEl = modal.querySelector('#wi-summary');
      const defsEl = modal.querySelector('#wi-defs');
      const transEl = modal.querySelector('#wi-trans');
      const imagesEl = modal.querySelector('#wi-images');

      const persistLangs = () => {
        store.updateSettings({ sourceLang: source, targetLang: target });
      };

      const refreshTranslations = async () => {
        if (!transEl) return;
        if (!online) {
          transEl.innerHTML = empty('Online lookups are turned off.');
          return;
        }
        transEl.innerHTML = skeleton();
        try {
          const data = await lookupTranslations(term, source, target);
          renderTranslations(transEl, data, '', target);
        } catch {
          transEl.innerHTML = empty('Could not load translations.');
        }
      };

      fromSel?.addEventListener('change', () => {
        source = fromSel.value;
        persistLangs();
        refreshTranslations();
      });
      toSel?.addEventListener('change', () => {
        target = toSel.value;
        persistLangs();
        refreshTranslations();
      });
      modal.querySelector('#wi-swap')?.addEventListener('click', () => {
        [source, target] = [target, source];
        if (fromSel) fromSel.value = source;
        if (toSel) toSel.value = target;
        persistLangs();
        refreshTranslations();
      });

      if (!online) return;

      const request = { source, target };
      lookup(term, { source, target })
        .then((data) => {
          renderSummary(summaryEl, data.summary, data.errors.summary);
          renderDefinitions(defsEl, data.definitions, data.errors.definitions);
          renderImages(imagesEl, data.images, data.errors.images);
          // Only render translations if the user hasn't changed the pair since.
          if (request.source === source && request.target === target) {
            renderTranslations(transEl, data.translations, data.errors.translations, target);
          }
        })
        .catch(() => {
          if (summaryEl) summaryEl.innerHTML = empty('Could not load information.');
          if (defsEl) defsEl.innerHTML = '';
          if (transEl) transEl.innerHTML = '';
          if (imagesEl) imagesEl.innerHTML = '';
        });
    },
  });
}

/* ------------------------------ renderers ----------------------------- */

function skeleton() {
  return `<div class="wi-skeleton"><span></span><span></span><span></span></div>`;
}

function empty(message) {
  return `<p class="wi-empty">${esc(message)}</p>`;
}

function renderSummary(el, summary, error) {
  if (!el) return;
  if (!summary) {
    el.innerHTML = empty(error ? 'Could not load an article.' : 'No article found.');
    return;
  }
  el.innerHTML = `
    <div class="wi-about">
      ${
        summary.image
          ? `<img class="wi-about__img" src="${esc(summary.image)}" alt="" loading="lazy" referrerpolicy="no-referrer" />`
          : ''
      }
      <div class="wi-about__text">
        <h4>${esc(summary.title)}</h4>
        <p>${esc(summary.extract)}</p>
        <a class="wi-link" href="${esc(summary.url)}" target="_blank" rel="noopener">
          Read on Wikipedia ${icon('external')}
        </a>
      </div>
    </div>
  `;
}

function renderDefinitions(el, definitions, error) {
  if (!el) return;
  if (!definitions || !definitions.length) {
    el.innerHTML = empty(error ? 'Could not load definitions.' : 'No definitions found.');
    return;
  }
  el.innerHTML = definitions
    .map(
      (entry) => `
      <div class="wi-defgroup">
        <div class="wi-pos">${esc(entry.partOfSpeech || 'definition')}${
        entry.language ? ` · ${esc(entry.language)}` : ''
      }</div>
        <ol class="wi-defs">
          ${entry.definitions
            .map(
              (d) => `
            <li>
              ${esc(d.text)}
              ${d.example ? `<span class="wi-example">“${esc(d.example)}”</span>` : ''}
            </li>`
            )
            .join('')}
        </ol>
      </div>`
    )
    .join('');
}

function renderTranslations(el, data, error, targetLang) {
  if (!el) return;
  const groups = (data?.groups || []).filter((g) => g.translations?.length);
  if (!data || (!data.primary && !groups.length)) {
    el.innerHTML = empty(error ? 'Could not load translations.' : 'No translations found.');
    return;
  }

  el.innerHTML = `
    ${
      data.primary
        ? `<div class="wi-primary">
            <span class="wi-primary__label">Best translation</span>
            <div class="wi-primary__row">
              <span class="wi-primary__text">${esc(data.primary)}</span>
              <button class="speaker-btn" data-say="${esc(data.primary)}" data-lang="${esc(
            targetLang
          )}" title="Pronounce" aria-label="Pronounce">${icon('volume')}</button>
            </div>
          </div>`
        : ''
    }
    ${groups
      .map(
        (group) => `
        <div class="wi-trans-group">
          <span class="chip">${esc(group.partOfSpeech || 'other')}</span>
          <div class="wi-chips">
            ${group.translations
              .map(
                (t) => `
              <button class="wi-chip" data-say="${esc(t)}" data-lang="${esc(
                  targetLang
                )}" title="Click to pronounce">
                ${esc(t)} ${icon('volume')}
              </button>`
              )
              .join('')}
          </div>
        </div>`
      )
      .join('')}
    <p class="wi-attrib">Via ${esc(data.provider || 'online translation')}. Click any translation to hear it.</p>
  `;

  el.querySelectorAll('[data-say]').forEach((btn) => {
    btn.addEventListener('click', () => speak(btn.dataset.say, btn.dataset.lang));
  });
}

function renderImages(el, images, error) {
  if (!el) return;
  if (!images || !images.length) {
    el.innerHTML = empty(error ? 'Could not load pictures.' : 'No pictures found.');
    return;
  }
  el.innerHTML = `
    <div class="wi-image-grid">
      ${images
        .map(
          (img) => `
        <a class="wi-thumb" href="${esc(img.page)}" target="_blank" rel="noopener" title="${esc(
            img.title
          )}">
          <img src="${esc(img.thumb)}" alt="${esc(img.title)}" loading="lazy" referrerpolicy="no-referrer" />
        </a>`
        )
        .join('')}
    </div>
    <p class="wi-attrib">Images from Wikimedia Commons. Click to open the source.</p>
  `;
}
