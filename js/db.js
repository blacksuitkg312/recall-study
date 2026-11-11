/* ==========================================================================
   db.js — local-first data store (localStorage) + tiny pub/sub
   ========================================================================== */

import { uid, dateKey, daysBetween } from './utils.js';
import { newSrs, normalizeSrs } from './srs.js';

const STORAGE_KEY = 'recall.db.v1';
const SCHEMA_VERSION = 1;

const ACCENTS = [
  '#6366f1', '#8b5cf6', '#ec4899', '#f43f5e',
  '#f59e0b', '#10b981', '#06b6d4', '#3b82f6',
];

function clampInt(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.round(n)));
}

function defaultSettings() {
  return {
    theme: 'light',
    dailyGoal: 20,
    newPerDay: 20,
    reviewsPerDay: 200,
    speechLang: 'en-US',
    sourceLang: 'en',
    targetLang: 'es',
    onlineLookups: true,
  };
}

function defaultState() {
  return {
    version: SCHEMA_VERSION,
    sets: [],
    settings: defaultSettings(),
    activity: {
      xp: 0,
      streak: 0,
      lastStudyDate: null,
      history: {}, // { 'YYYY-MM-DD': cardsStudied }
      counts: {}, // { 'YYYY-MM-DD': { new, review } } for daily limits
    },
  };
}

function migrate(state) {
  // Future schema migrations go here.
  if (!state.version) state.version = SCHEMA_VERSION;
  state.settings = { ...defaultSettings(), ...(state.settings || {}) };
  state.settings.dailyGoal = clampInt(state.settings.dailyGoal, 1, 500, 20);
  state.settings.newPerDay = clampInt(state.settings.newPerDay, 0, 200, 20);
  state.settings.reviewsPerDay = clampInt(state.settings.reviewsPerDay, 0, 1000, 200);

  if (!state.activity) {
    state.activity = { xp: 0, streak: 0, lastStudyDate: null, history: {}, counts: {} };
  }
  if (!state.activity.history) state.activity.history = {};
  if (!state.activity.counts) state.activity.counts = {};

  state.sets = (state.sets || []).map((s) => ({
    ...s,
    accent: s.accent || ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
    cards: (s.cards || []).map((c) => ({
      ...c,
      srs: normalizeSrs(c.srs),
    })),
  }));
  return state;
}

class Store {
  constructor() {
    this.state = this._load();
    this._subs = new Set();
    this._applyTheme();
  }

  _load() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return defaultState();
      return migrate(JSON.parse(raw));
    } catch (err) {
      console.warn('Could not load saved data, starting fresh.', err);
      return defaultState();
    }
  }

  _persist() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(this.state));
    } catch (err) {
      console.error('Failed to save data (storage may be full).', err);
    }
  }

  _emit() {
    this._persist();
    this._subs.forEach((fn) => fn(this.state));
  }

  _applyTheme() {
    document.documentElement.setAttribute('data-theme', this.state.settings.theme || 'light');
  }

  subscribe(fn) {
    this._subs.add(fn);
    return () => this._subs.delete(fn);
  }

  getState() {
    return this.state;
  }

  /* ----------------------------- settings ----------------------------- */

  setTheme(theme) {
    this.state.settings.theme = theme;
    this._applyTheme();
    this._emit();
  }

  toggleTheme() {
    this.setTheme(this.state.settings.theme === 'dark' ? 'light' : 'dark');
  }

  setDailyGoal(n) {
    this.state.settings.dailyGoal = Math.max(1, Math.min(500, Number(n) || 20));
    this._emit();
  }

  /** Update any settings in one go. */
  updateSettings(patch = {}) {
    this.state.settings = { ...this.state.settings, ...patch };
    this.state.settings.dailyGoal = clampInt(this.state.settings.dailyGoal, 1, 500, 20);
    this.state.settings.newPerDay = clampInt(this.state.settings.newPerDay, 0, 200, 20);
    this.state.settings.reviewsPerDay = clampInt(
      this.state.settings.reviewsPerDay,
      0,
      1000,
      200
    );
    this._applyTheme();
    this._emit();
  }

  /* ------------------------------- sets ------------------------------- */

  getSets() {
    return this.state.sets;
  }

  getSet(id) {
    return this.state.sets.find((s) => s.id === id) || null;
  }

  /** Find the set that owns a card (used when editing from a study session). */
  findSetByCardId(cardId) {
    return (
      this.state.sets.find((s) => s.cards.some((c) => c.id === cardId)) || null
    );
  }

  createSet({ title = 'Untitled set', description = '', cards = [] } = {}) {
    const now = Date.now();
    const set = {
      id: uid('set_'),
      title: title.trim() || 'Untitled set',
      description: description.trim(),
      accent: ACCENTS[Math.floor(Math.random() * ACCENTS.length)],
      createdAt: now,
      updatedAt: now,
      cards: cards.map((c) => ({
        id: uid('card_'),
        term: String(c.term || '').trim(),
        definition: String(c.definition || '').trim(),
        createdAt: now,
        srs: newSrs(),
      })),
    };
    this.state.sets.unshift(set);
    this._emit();
    return set;
  }

  updateSet(id, patch) {
    const set = this.getSet(id);
    if (!set) return null;
    if (patch.title !== undefined) set.title = String(patch.title).trim() || 'Untitled set';
    if (patch.description !== undefined) set.description = String(patch.description).trim();
    if (patch.accent !== undefined) set.accent = patch.accent;
    set.updatedAt = Date.now();
    this._emit();
    return set;
  }

  deleteSet(id) {
    this.state.sets = this.state.sets.filter((s) => s.id !== id);
    this._emit();
  }

  duplicateSet(id) {
    const src = this.getSet(id);
    if (!src) return null;
    const copy = this.createSet({
      title: `${src.title} (copy)`,
      description: src.description,
      cards: src.cards.map((c) => ({ term: c.term, definition: c.definition })),
    });
    copy.accent = src.accent;
    this._emit();
    return copy;
  }

  /* ------------------------------- cards ------------------------------ */

  addCard(setId, { term = '', definition = '' } = {}) {
    const set = this.getSet(setId);
    if (!set) return null;
    const card = {
      id: uid('card_'),
      term: String(term).trim(),
      definition: String(definition).trim(),
      createdAt: Date.now(),
      srs: newSrs(),
    };
    set.cards.push(card);
    set.updatedAt = Date.now();
    this._emit();
    return card;
  }

  updateCard(setId, cardId, patch) {
    const set = this.getSet(setId);
    if (!set) return null;
    const card = set.cards.find((c) => c.id === cardId);
    if (!card) return null;

    const nextTerm = patch.term !== undefined ? String(patch.term).trim() : card.term;
    const nextDefinition =
      patch.definition !== undefined ? String(patch.definition).trim() : card.definition;
    const contentChanged = nextTerm !== card.term || nextDefinition !== card.definition;

    card.term = nextTerm;
    card.definition = nextDefinition;

    // Rewriting a leech card is the fix: clear the flag so it can re-enter
    // normal rotation without being treated as a problem card forever.
    if (contentChanged && card.srs?.leech) {
      card.srs = { ...card.srs, leech: false };
    }

    set.updatedAt = Date.now();
    this._emit();
    return card;
  }

  deleteCard(setId, cardId) {
    const set = this.getSet(setId);
    if (!set) return;
    set.cards = set.cards.filter((c) => c.id !== cardId);
    set.updatedAt = Date.now();
    this._emit();
  }

  /** Replace all cards for a set (used by the bulk editor). */
  setCards(setId, cards) {
    const set = this.getSet(setId);
    if (!set) return;
    const byId = new Map(set.cards.map((c) => [c.id, c]));
    set.cards = cards
      .filter((c) => String(c.term).trim() || String(c.definition).trim())
      .map((c) => {
        const existing = c.id && byId.get(c.id);
        const term = String(c.term || '').trim();
        const definition = String(c.definition || '').trim();
        let srs = existing ? normalizeSrs(existing.srs) : newSrs();
        if (existing && (existing.term !== term || existing.definition !== definition) && srs.leech) {
          srs = { ...srs, leech: false };
        }
        return {
          id: c.id || uid('card_'),
          term,
          definition,
          createdAt: existing ? existing.createdAt : Date.now(),
          srs,
        };
      });
    set.updatedAt = Date.now();
    this._emit();
  }

  /* ----------------------------- activity ----------------------------- */

  /**
   * Record a single card review. Updates XP, streak and daily history.
   *
   * @param {object} [opts]
   * @param {boolean} [opts.wasNew]    card had never been reviewed before
   * @param {boolean} [opts.practice]  Test/Match practice: XP + streak only
   * @param {boolean} [opts.counts]    false for repeat ratings of one card
   */
  recordReview({ wasNew = false, practice = false, counts = true } = {}) {
    const act = this.state.activity;
    const today = dateKey();

    // Streak logic: if last study day was yesterday -> +1, if today -> keep,
    // otherwise reset to 1.
    if (act.lastStudyDate !== today) {
      if (act.lastStudyDate && daysBetween(act.lastStudyDate, today) === 1) {
        act.streak += 1;
      } else {
        act.streak = 1;
      }
      act.lastStudyDate = today;
    }

    act.history[today] = (act.history[today] || 0) + 1;

    if (counts && !practice) {
      if (!act.counts) act.counts = {};
      const day = act.counts[today] || { new: 0, review: 0 };
      if (wasNew) day.new += 1;
      else day.review += 1;
      act.counts[today] = day;
      this._pruneCounts();
    }

    act.xp += 10;
    this._emit();
  }

  /** Keep the per-day new/review counters from growing forever. */
  _pruneCounts() {
    const counts = this.state.activity.counts || {};
    const keys = Object.keys(counts).sort();
    if (keys.length > 90) {
      keys.slice(0, keys.length - 90).forEach((key) => delete counts[key]);
    }
  }

  /** New/review counts already used today (for daily limits). */
  countsToday() {
    const day = this.state.activity.counts?.[dateKey()];
    return { new: day?.new || 0, review: day?.review || 0 };
  }

  /** Cards studied today. */
  studiedToday() {
    return this.state.activity.history[dateKey()] || 0;
  }

  /** Aggregate stats for the dashboard. */
  stats() {
    const sets = this.state.sets;
    const totalCards = sets.reduce((n, s) => n + s.cards.length, 0);
    const now = Date.now();
    const due = sets.reduce(
      (n, s) => n + s.cards.filter((c) => !c.srs || c.srs.due <= now).length,
      0
    );
    return {
      sets: sets.length,
      cards: totalCards,
      due,
      studiedToday: this.studiedToday(),
      xp: this.state.activity.xp,
      streak: this.state.activity.streak,
    };
  }

  /* --------------------------- import/export -------------------------- */

  exportData() {
    return JSON.stringify(this.state, null, 2);
  }

  /**
   * Import data. Accepts either a full Recall export, or a simple
   * array of sets / a single set object (best-effort).
   */
  importData(raw) {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;

    // Full export
    if (parsed && Array.isArray(parsed.sets)) {
      const incoming = migrate(parsed);
      this.state = incoming;
      this._applyTheme();
      this._emit();
      return { sets: incoming.sets.length };
    }

    // Array of sets
    if (Array.isArray(parsed)) {
      parsed.forEach((s) => this._importSet(s));
      this._emit();
      return { sets: parsed.length };
    }

    // Single set
    if (parsed && (parsed.title || parsed.cards)) {
      this._importSet(parsed);
      this._emit();
      return { sets: 1 };
    }

    throw new Error('Unrecognized file format.');
  }

  _importSet(s) {
    const cards = Array.isArray(s.cards)
      ? s.cards.map((c) => ({
          term: c.term ?? c.word ?? c.front ?? '',
          definition: c.definition ?? c.meaning ?? c.back ?? '',
        }))
      : [];
    this.createSet({
      title: s.title || 'Imported set',
      description: s.description || '',
      cards,
    });
  }

  resetAll() {
    this.state = defaultState();
    this._applyTheme();
    this._emit();
  }
}

export const store = new Store();
export { ACCENTS };
