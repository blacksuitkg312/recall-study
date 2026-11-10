/* ==========================================================================
   cardeditor.js — edit or delete a single card from anywhere
   ========================================================================== */

import { store } from './db.js';
import { openModal, closeModal, confirmDialog, toast } from './components.js';
import { esc } from './utils.js';

/**
 * Open a modal to edit a card's term/definition.
 * @param {object} card the live card object
 * @param {{onSaved?:Function,onDeleted?:Function}} handlers
 */
export function openCardEditor(card, { onSaved, onDeleted } = {}) {
  const set = store.findSetByCardId(card.id);
  if (!set) {
    toast('Could not find this card', 'danger');
    return;
  }

  openModal({
    title: 'Edit card',
    body: `
      <div class="field">
        <label for="ce-term">Term</label>
        <textarea class="textarea" id="ce-term" placeholder="Term or question">${esc(card.term)}</textarea>
      </div>
      <div class="field" style="margin-bottom:8px">
        <label for="ce-def">Definition</label>
        <textarea class="textarea" id="ce-def" placeholder="Definition or answer">${esc(card.definition)}</textarea>
      </div>
    `,
    actions: [
      {
        label: 'Delete',
        className: 'btn--danger',
        onClick: async () => {
          closeModal();
          const ok = await confirmDialog({
            title: 'Delete this card?',
            message: `“${card.term}” will be removed from “${set.title}”.`,
            confirmLabel: 'Delete card',
            danger: true,
          });
          if (!ok) return;
          store.deleteCard(set.id, card.id);
          toast('Card deleted', 'success');
          if (onDeleted) onDeleted(card);
        },
      },
      { label: 'Cancel', className: 'btn--ghost', onClick: closeModal },
      {
        label: 'Save',
        className: 'btn--primary',
        onClick: () => {
          const term = document.getElementById('ce-term')?.value.trim() || '';
          const definition = document.getElementById('ce-def')?.value.trim() || '';
          if (!term || !definition) {
            toast('Both a term and a definition are required', 'danger');
            return;
          }
          store.updateCard(set.id, card.id, { term, definition });
          closeModal();
          toast('Card updated', 'success');
          if (onSaved) onSaved(card);
        },
      },
    ],
    onMount: (modal) => {
      const term = modal.querySelector('#ce-term');
      if (term) {
        term.focus();
        term.setSelectionRange(term.value.length, term.value.length);
      }
    },
  });
}
