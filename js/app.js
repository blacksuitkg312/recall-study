/* ==========================================================================
   app.js — hash router + view mounting
   ========================================================================== */

import { renderDashboard, mountDashboard } from './views/dashboard.js';
import { renderSet, mountSet } from './views/set.js';
import { renderEditor, mountEditor } from './views/editor.js';
import { renderStudy, mountStudy } from './views/study.js';
import { renderProgress, mountProgress } from './views/progress.js';
import { store } from './db.js';

// Exposed for debugging and automated smoke tests.
window.__recall = { store };

const app = document.getElementById('app');

/** Parse the current hash into a route descriptor. */
function parseRoute() {
  const raw = location.hash.replace(/^#/, '') || '/';
  const parts = raw.split('/').filter(Boolean);

  if (parts.length === 0) return { name: 'dashboard', params: {} };

  const [head, a, b] = parts;

  switch (head) {
    case 'progress':
      return { name: 'progress', params: {} };
    case 'new':
      return { name: 'editor', params: { id: 'new' } };
    case 'set':
      return { name: 'set', params: { id: a } };
    case 'edit':
      return { name: 'editor', params: { id: a } };
    case 'study':
      return { name: 'study', params: { id: a, mode: b || 'flashcards' } };
    case 'due':
      return { name: 'study', params: { id: '__due__', mode: 'learn' } };
    default:
      return { name: 'dashboard', params: {} };
  }
}

function render() {
  // Run cleanup registered by the previous view (timers, listeners).
  if (typeof window.__routeCleanup === 'function') {
    try {
      window.__routeCleanup();
    } catch (err) {
      console.warn('Route cleanup failed', err);
    }
    window.__routeCleanup = null;
  }

  const route = parseRoute();
  let html = '';
  let mount = null;

  switch (route.name) {
    case 'dashboard':
      html = renderDashboard(route.params);
      mount = mountDashboard;
      break;
    case 'progress':
      html = renderProgress(route.params);
      mount = mountProgress;
      break;
    case 'set':
      html = renderSet(route.params);
      mount = mountSet;
      break;
    case 'editor':
      html = renderEditor(route.params);
      mount = mountEditor;
      break;
    case 'study':
      html = renderStudy(route.params);
      mount = mountStudy;
      break;
    default:
      html = renderDashboard(route.params);
      mount = mountDashboard;
  }

  app.innerHTML = html;

  if (typeof mount === 'function') {
    try {
      mount(route.params);
    } catch (err) {
      console.error('Failed to mount view', err);
    }
  }

  // Scroll to top on navigation.
  window.scrollTo(0, 0);
}

window.addEventListener('hashchange', render);

// Module scripts are deferred: by the time this runs the DOM is parsed, but
// guard for safety so we render exactly once.
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', render);
} else {
  render();
}
