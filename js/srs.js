/* ==========================================================================
   srs.js — spaced repetition (SM-2 + learning steps)
   --------------------------------------------------------------------------
   Each card carries an srs object:
     { ease, interval (days), due (timestamp ms), reps, lapses, lastReview,
       step, learning, leech }

   New cards walk through short learning steps before graduating to real
   review intervals. Review cards use a fuzzed SM-2 interval with a maximum
   of one year. Cards that lapse repeatedly are flagged as leeches so the
   learner can rewrite them.
   ========================================================================== */

export const RATINGS = {
  again: { q: 1, label: 'Again', hint: '< 1 min' },
  hard: { q: 3, label: 'Hard', hint: 'soon' },
  good: { q: 4, label: 'Good', hint: 'later' },
  easy: { q: 5, label: 'Easy', hint: 'much later' },
};

export const MIN_EASE = 1.3;
export const LEECH_THRESHOLD = 8;
export const MAX_INTERVAL = 365; // days

const DAY = 86400000;
const MINUTE = 60000;

// Minutes between learning reviews. A card graduates after the last step.
const LEARNING_STEPS = [1, 10];

/** Fresh scheduling state for a new card. */
export function newSrs() {
  return {
    ease: 2.5,
    interval: 0,
    due: Date.now(), // due immediately
    reps: 0,
    lapses: 0,
    lastReview: null,
    step: 0,
    learning: true,
    leech: false,
  };
}

/**
 * Fill in fields added after a card was created (keeps saved data working).
 * Returns a new object; does not mutate the input.
 */
export function normalizeSrs(srs) {
  const raw = srs || {};
  const s = { ...newSrs(), ...raw };

  // Older cards predate learning steps: anything never reviewed is learning.
  if (raw.learning === undefined) s.learning = !raw.lastReview;
  if (raw.step === undefined) s.step = s.learning ? 0 : LEARNING_STEPS.length;
  if (raw.leech === undefined) s.leech = (raw.lapses || 0) >= LEECH_THRESHOLD;

  return s;
}

/** Spread reviews out so cards learned together do not clump forever. */
function fuzzInterval(days) {
  if (days < 3) return days;
  const spread = Math.max(1, Math.round(days * 0.05));
  return days + Math.floor(Math.random() * (spread * 2 + 1)) - spread;
}

function capInterval(days) {
  return Math.min(MAX_INTERVAL, Math.max(1, Math.round(days)));
}

/**
 * Apply a rating to a card's srs state. Returns a NEW srs object.
 * @param {object} srs
 * @param {'again'|'hard'|'good'|'easy'} rating
 * @param {number} now
 */
export function schedule(srs, rating, now = Date.now()) {
  const s = normalizeSrs(srs);
  const key = RATINGS[rating] ? rating : 'good';
  const q = RATINGS[key].q;

  if (s.learning) {
    if (key === 'again') {
      // Restart the learning steps. Learning failures are not lapses.
      s.step = 0;
      s.interval = 0;
      s.due = now + LEARNING_STEPS[0] * MINUTE;
    } else if (key === 'hard') {
      // Repeat the current step.
      s.step = Math.min(s.step || 0, LEARNING_STEPS.length - 1);
      s.due = now + LEARNING_STEPS[s.step] * MINUTE;
    } else {
      // Good advances one step; Easy skips straight to graduation.
      s.step = (s.step || 0) + (key === 'easy' ? LEARNING_STEPS.length : 1);
      if (s.step >= LEARNING_STEPS.length) {
        s.learning = false;
        s.step = LEARNING_STEPS.length;
        s.reps += 1;
        s.interval = key === 'easy' ? 3 : 1;
        s.due = now + s.interval * DAY;
      } else {
        s.due = now + LEARNING_STEPS[s.step] * MINUTE;
      }
    }
  } else if (q < 3) {
    // Failed review: relearn from the first step and count a lapse.
    s.lapses += 1;
    s.ease = Math.max(MIN_EASE, s.ease - 0.2);
    s.reps = 0;
    s.interval = 0;
    s.learning = true;
    s.step = 0;
    s.due = now + LEARNING_STEPS[0] * MINUTE;
    if (s.lapses >= LEECH_THRESHOLD) s.leech = true;
  } else {
    // Successful review: update ease factor (SM-2 formula).
    s.ease = Math.max(
      MIN_EASE,
      s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );

    if (s.reps === 0) {
      s.interval = 1;
    } else if (s.reps === 1) {
      s.interval = key === 'hard' ? 3 : 6;
    } else {
      let mult = s.ease;
      if (key === 'hard') mult = Math.max(1.2, s.ease - 0.4);
      if (key === 'easy') mult = s.ease + 0.3;
      s.interval = Math.max(1, Math.round(s.interval * mult));
    }

    // "Again"-free but Hard on a brand-new card still means ~1 day.
    if (key === 'easy' && s.reps === 0) s.interval = 3;

    s.interval = capInterval(fuzzInterval(s.interval));
    s.reps += 1;
    s.due = now + s.interval * DAY;
  }

  s.lastReview = now;
  return s;
}

/** Is a card due for review right now? */
export function isDue(srs, now = Date.now()) {
  if (!srs) return true;
  return srs.due <= now;
}

/** Cards that are due (or new). */
export function dueCards(cards, now = Date.now()) {
  return cards.filter((c) => isDue(c.srs, now));
}

/**
 * Priority score for choosing which due card to show first.
 * Higher = more urgent. Overdue time dominates, then lapses/ease, then
 * new-card and leech boosts. A little jitter is added by orderByPriority().
 */
export function priorityScore(srs, now = Date.now()) {
  const s = normalizeSrs(srs);
  const overdueDays = Math.max(0, (now - s.due) / DAY);
  const weakness = 2 * (s.lapses || 0) + 2 * Math.max(0, 2.5 - s.ease);
  const newBoost = s.lastReview ? 0 : 1.5;
  const leechBoost = s.leech ? 2 : 0;
  return 3 * Math.min(overdueDays, 30) + weakness + newBoost + leechBoost;
}

/**
 * Order cards by priority (most urgent first) with a small random jitter so
 * sessions do not feel identical every day.
 */
export function orderByPriority(cards, now = Date.now()) {
  return cards
    .map((card) => ({
      card,
      score: priorityScore(card.srs, now) + Math.random() * 0.75,
    }))
    .sort((a, b) => b.score - a.score)
    .map((x) => x.card);
}

/**
 * Mastery score 0–100 for a single card.
 * Weighted blend of successful reps and current interval.
 */
export function cardMastery(srs) {
  if (!srs || !srs.lastReview) return 0;
  const repsScore = Math.min(1, srs.reps / 4); // 4 clean reviews ~ mastered
  const intervalScore = Math.min(1, srs.interval / 21); // 3 weeks ~ mastered
  const lapsePenalty = Math.min(0.4, srs.lapses * 0.1);
  return Math.round(
    Math.max(0, (0.6 * repsScore + 0.4 * intervalScore - lapsePenalty) * 100)
  );
}

/** Set-level mastery: average across cards. */
export function setMastery(cards) {
  if (!cards.length) return 0;
  const total = cards.reduce((sum, c) => sum + cardMastery(c.srs), 0);
  return Math.round(total / cards.length);
}

/** Human-readable next-review label. */
export function dueLabel(srs, now = Date.now()) {
  if (!srs || !srs.lastReview) return 'New';
  const diff = srs.due - now;
  if (diff <= 0) return 'Due now';
  const mins = Math.ceil(diff / MINUTE);
  if (mins < 60) return `in ${mins}m`;
  const hrs = Math.ceil(mins / 60);
  if (hrs < 24) return `in ${hrs}h`;
  const days = Math.ceil(hrs / 24);
  return `in ${days}d`;
}

/** How many cards are due within the next `horizon` ms. */
export function dueSoon(cards, horizon = DAY, now = Date.now()) {
  return cards.filter((c) => c.srs && c.srs.due > now && c.srs.due <= now + horizon);
}
