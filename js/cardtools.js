/* ==========================================================================
   cardtools.js — speaker / word info / edit / delete buttons for a card
   --------------------------------------------------------------------------
   Used both in the set term list and inside study sessions so a learner can
   correct or remove a word without leaving the session.
   ========================================================================== */

import { store } from './db.js';
import { icon } from './icons.js';
import { toast, confirmDialog } from './components.js';
import { speak } from './speech.js';
import { openWordInfo } from './wordinfo.js';
import { openCardEditor } from './cardeditor.js';

/**
 * Markup for the card tool buttons.
 * @param {{info?:boolean, edit?:boolean, del?:boolean}} opts
 */
export function cardToolsHTML({ info = true, edit = true, del = true } = {}) {
  return `
    <span class="card-tools">
      <button class="iconbtn card-tool" data-tool="speak" title="Pronounce" aria-label="Pronounce">
        ${icon('volume')}
      </button>
      ${
        info
          ? `<button class="iconbtn card-tool" data-tool="info" title="Word info" aria-label="Word info">
              ${icon('globe')}
            </button>`
          : ''
      }
      ${
        edit
          ? `<button class="iconbtn card-tool" data-tool="edit" title="Edit card" aria-label="Edit card">
              ${icon('edit')}
            </button>`
          : ''
      }
      ${
        del
          ? `<button class="iconbtn card-tool card-tool--danger" data-tool="delete" title="Delete card" aria-label="Delete card">
              ${icon('trash')}
            </button>`
          : ''
      }
    </span>
  `;
}

/**
 * Wire up every `[data-tool]` button inside `scope` for one card.
 *
 * @param {Element} scope container that holds the buttons
 * @param {object} opts
 * @param {object} opts.card      the live card object
 * @param {Function} [opts.onChanged] called after the card is edited
 * @param {Function} [opts.onDeleted] called after the card is deleted
 * @param {string} [opts.lang]    pronunciation language override
 */
export function bindCardTools(scope, { card, onChanged, onDeleted, lang } = {}) {
  if (!scope || !card) return;

  scope.querySelectorAll('[data-tool]').forEach((btn) => {
    btn.addEventListener('click', async (event) => {
      event.preventDefault();
      event.stopPropagation();

      const tool = btn.dataset.tool;
      if (tool === 'speak') {
        const language = lang || store.getState().settings.speechLang || 'en';
        if (!speak(card.term, language)) toast('Pronunciation is not available here', 'danger');
        return;
      }

      if (tool === 'info') {
        openWordInfo({
          term: card.term,
          definition: card.definition,
          card,
          onChanged,
          onDeleted,
        });
        return;
      }

      if (tool === 'edit') {
        openCardEditor(card, { onSaved: onChanged, onDeleted });
        return;
      }

      if (tool === 'delete') {
        const set = store.findSetByCardId(card.id);
        if (!set) {
          toast('This card is already gone', 'danger');
          return;
        }
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
      }
    });
  });
}
