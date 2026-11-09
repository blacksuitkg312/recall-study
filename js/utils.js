/* ==========================================================================
   utils.js — small helpers shared across the app
   ========================================================================== */

/** Generate a reasonably unique id. */
export function uid(prefix = '') {
  const rand = Math.random().toString(36).slice(2, 9);
  return `${prefix}${Date.now().toString(36)}${rand}`;
}

/** Escape a string for safe insertion into HTML. */
export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/** Fisher–Yates shuffle (returns a new array). */
export function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** Pick `n` random items from an array. */
export function sample(arr, n) {
  return shuffle(arr).slice(0, n);
}

/** Clamp a number between min and max. */
export function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n));
}

/** Local date key: YYYY-MM-DD. */
export function dateKey(date = new Date()) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/** Day difference between two YYYY-MM-DD keys. */
export function daysBetween(aKey, bKey) {
  const a = new Date(aKey + 'T00:00:00');
  const b = new Date(bKey + 'T00:00:00');
  return Math.round((b - a) / 86400000);
}

/** Human friendly relative time. */
export function timeAgo(ts) {
  if (!ts) return 'never';
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(ts).toLocaleDateString();
}

/** Debounce a function. */
export function debounce(fn, wait = 250) {
  let t;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), wait);
  };
}

/** Case/whitespace-insensitive comparison for typed answers. */
export function normalizeAnswer(str) {
  return String(str ?? '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ')
    .replace(/[.,;:!?'"“”‘’()]/g, '');
}

/** Quick Levenshtein distance for "close enough" typed answers. */
export function levenshtein(a, b) {
  a = a.slice(0, 60);
  b = b.slice(0, 60);
  const dp = Array.from({ length: b.length + 1 }, (_, i) => i);
  for (let i = 1; i <= a.length; i++) {
    let prev = dp[0];
    dp[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const tmp = dp[j];
      dp[j] = Math.min(
        dp[j] + 1,
        dp[j - 1] + 1,
        prev + (a[i - 1] === b[j - 1] ? 0 : 1)
      );
      prev = tmp;
    }
  }
  return dp[b.length];
}

/** A typed answer counts as correct if normalized-equal or a tiny typo away. */
export function answersMatch(given, expected) {
  const g = normalizeAnswer(given);
  const e = normalizeAnswer(expected);
  if (!g) return false;
  if (g === e) return true;
  // Allow one typo for longer answers.
  if (e.length >= 5 && levenshtein(g, e) <= 1) return true;
  if (e.length >= 9 && levenshtein(g, e) <= 2) return true;
  return false;
}

/** Pluralize a word. */
export function plural(n, word, pluralWord) {
  return `${n} ${n === 1 ? word : pluralWord || word + 's'}`;
}
