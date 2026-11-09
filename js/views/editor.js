/* ==========================================================================
   views/editor.js — create / edit a set
   ========================================================================== */

import { store } from '../db.js';
import { icon } from '../icons.js';
import { esc, uid } from '../utils.js';
import { renderHeader, bindHeader, toast, confirmDialog } from '../components.js';

export function renderEditor({ id }) {
  const isNew = !id || id === 'new';
  const set = isNew ? null : store.getSet(id);
  if (!isNew && !set) return notFound();

  const title = set ? set.title : '';
  const description = set ? set.description : '';
  const cards = set ? set.cards : [{ id: uid('card_'), term: '', definition: '' }];

  return `
    ${renderHeader()}
    <main class="page">
      <div class="container" style="max-width:840px">
        <div class="editor-head">
          <div>
            <div class="crumbs">
              <a href="#/">Library</a> ${icon('chevronRight')}
              <span>${isNew ? 'New set' : 'Edit set'}</span>
            </div>
            <h1 style="font-size:24px">${isNew ? 'Create a new set' : 'Edit set'}</h1>
          </div>
          <div class="editor-head__actions">
            <a href="${isNew ? '#/' : `#/set/${set.id}`}" class="btn btn--ghost" id="cancel-btn">Cancel</a>
            <button class="btn btn--primary" id="save-btn">${icon('check')} Save</button>
          </div>
        </div>

        <div class="field">
          <label for="set-title">Title</label>
          <input id="set-title" class="input input--title" placeholder="e.g. Spanish — Food vocabulary" value="${esc(title)}" />
        </div>

        <div class="field">
          <label for="set-desc">Description <span class="faint">(optional)</span></label>
          <textarea id="set-desc" class="textarea" placeholder="What is this set about?">${esc(description)}</textarea>
        </div>

        <div class="section-head" style="margin-top:26px">
          <div>
            <h2 style="font-size:18px">Cards</h2>
            <p id="card-count">${cards.length} ${cards.length === 1 ? 'card' : 'cards'}</p>
          </div>
          <div class="row gap-8">
            <button class="btn btn--outline btn--sm" id="bulk-add-btn">${icon('clipboard')} Paste list</button>
            <button class="btn btn--soft btn--sm" id="add-card-btn">${icon('plus')} Add card</button>
          </div>
        </div>

        <div id="card-editors">
          ${cards.map((c, i) => cardEditorRow(c, i)).join('')}
        </div>

        <div class="add-row">
          <button class="btn btn--outline btn--block" id="add-card-bottom">${icon('plus')} Add another card</button>
        </div>

        <div class="row gap-8 mt-24" style="justify-content:flex-end">
          <a href="${isNew ? '#/' : `#/set/${set.id}`}" class="btn btn--ghost">Cancel</a>
          <button class="btn btn--primary btn--lg" id="save-btn-bottom">${icon('check')} Save set</button>
        </div>
      </div>
    </main>
  `;
}

function cardEditorRow(card, index) {
  return `
    <div class="card-editor" data-card-id="${card.id}">
      <div class="card-editor__side">
        <span>Term</span>
        <textarea data-field="term" placeholder="Term or question">${esc(card.term || '')}</textarea>
      </div>
      <div class="card-editor__side">
        <span>Definition</span>
        <textarea data-field="definition" placeholder="Definition or answer">${esc(card.definition || '')}</textarea>
      </div>
      <div class="card-editor__controls">
        <button class="iconbtn" data-action="delete" title="Delete card" aria-label="Delete card">${icon('trash')}</button>
      </div>
    </div>
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

export function mountEditor({ id }) {
  bindHeader();
  const isNew = !id || id === 'new';
  const existing = isNew ? null : store.getSet(id);

  const container = document.getElementById('card-editors');
  const countEl = document.getElementById('card-count');

  const getRows = () =>
    Array.from(container.querySelectorAll('.card-editor')).map((row) => ({
      id: row.dataset.cardId,
      term: row.querySelector('[data-field="term"]').value,
      definition: row.querySelector('[data-field="definition"]').value,
    }));

  const updateCount = () => {
    const n = getRows().length;
    if (countEl) countEl.textContent = `${n} ${n === 1 ? 'card' : 'cards'}`;
  };

  const addRow = (card = { id: uid('card_'), term: '', definition: '' }, focus = true) => {
    const wrap = document.createElement('div');
    wrap.innerHTML = cardEditorRow(card, container.children.length);
    const row = wrap.firstElementChild;
    container.appendChild(row);
    updateCount();
    if (focus) row.querySelector('[data-field="term"]').focus();
  };

  // Delegate delete buttons.
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-action="delete"]');
    if (!btn) return;
    const row = btn.closest('.card-editor');
    if (container.children.length <= 1) {
      // Clear instead of removing the last row.
      row.querySelector('[data-field="term"]').value = '';
      row.querySelector('[data-field="definition"]').value = '';
      return;
    }
    row.remove();
    updateCount();
  });

  document.getElementById('add-card-btn')?.addEventListener('click', () => addRow());
  document.getElementById('add-card-bottom')?.addEventListener('click', () => addRow());

  document.getElementById('bulk-add-btn')?.addEventListener('click', () => {
    import('../components.js').then(({ openModal, closeModal }) => {
      openModal({
        title: 'Paste a list',
        body: `
          <p>One card per line. Separate term and definition with a tab, comma, or dash.</p>
          <textarea class="textarea" id="bulk-input" style="min-height:180px" placeholder="hola - hello&#10;adiós, goodbye&#10;gato\tdog"></textarea>
          <p class="faint" style="margin-top:8px;font-size:12px">Tip: paste directly from a spreadsheet.</p>
        `,
        actions: [
          { label: 'Cancel', className: 'btn--ghost', onClick: closeModal },
          {
            label: 'Add cards',
            className: 'btn--primary',
            onClick: () => {
              const raw = document.getElementById('bulk-input')?.value || '';
              const parsed = parseBulk(raw);
              if (!parsed.length) {
                toast('No cards recognized', 'danger');
                return;
              }
              // Remove the initial empty row if present.
              const rows = getRows();
              if (rows.length === 1 && !rows[0].term && !rows[0].definition) {
                container.innerHTML = '';
              }
              parsed.forEach((c) => addRow({ id: uid('card_'), ...c }, false));
              updateCount();
              closeModal();
              toast(`Added ${parsed.length} cards`, 'success');
            },
          },
        ],
        onMount: (modal) => modal.querySelector('#bulk-input')?.focus(),
      });
    });
  });

  const save = () => {
    const title = document.getElementById('set-title').value.trim() || 'Untitled set';
    const description = document.getElementById('set-desc').value.trim();
    const cards = getRows();
    const nonEmpty = cards.filter((c) => c.term.trim() || c.definition.trim());

    if (!nonEmpty.length) {
      toast('Add at least one card before saving', 'danger');
      return;
    }
    if (nonEmpty.some((c) => !c.term.trim() || !c.definition.trim())) {
      toast('Each card needs both a term and a definition', 'danger');
      return;
    }

    if (isNew) {
      const set = store.createSet({ title, description, cards: nonEmpty });
      toast('Set created', 'success');
      location.hash = `#/set/${set.id}`;
    } else {
      store.updateSet(existing.id, { title, description });
      store.setCards(existing.id, nonEmpty);
      toast('Changes saved', 'success');
      location.hash = `#/set/${existing.id}`;
    }
  };

  document.getElementById('save-btn')?.addEventListener('click', save);
  document.getElementById('save-btn-bottom')?.addEventListener('click', save);

  // Ctrl/Cmd+S to save.
  const onKey = (e) => {
    if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 's') {
      e.preventDefault();
      save();
    }
  };
  document.addEventListener('keydown', onKey);

  // Cleanup when leaving the route.
  window.__routeCleanup = () => document.removeEventListener('keydown', onKey);
}

/** Parse pasted text into {term, definition} pairs. */
function parseBulk(raw) {
  const lines = raw.split(/\r?\n/);
  const out = [];
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    // Priority: tab, then " - ", then comma, then first dash.
    let parts = null;
    if (trimmed.includes('\t')) parts = trimmed.split('\t');
    else if (/\s[-–—]\s/.test(trimmed)) parts = trimmed.split(/\s[-–—]\s/);
    else if (trimmed.includes(',')) parts = trimmed.split(',');
    else if (trimmed.includes('-')) {
      const i = trimmed.indexOf('-');
      parts = [trimmed.slice(0, i), trimmed.slice(i + 1)];
    }
    if (!parts || parts.length < 2) continue;
    const term = parts[0].trim();
    const definition = parts.slice(1).join(' ').trim();
    if (term && definition) out.push({ term, definition });
  }
  return out;
}
