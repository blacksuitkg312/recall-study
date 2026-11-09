/* ==========================================================================
   srs.js — spaced repetition (SM-2 style)
   --------------------------------------------------------------------------
   Each card carries an srs object:
     { ease, interval (days), due (timestamp ms), reps, lapses, lastReview }
   Ratings map to SM-2 quality:
     again -> 1, hard -> 3, good -> 4, easy -> 5
   ========================================================================== */

export const RATINGS = {
  again: { q: 1, label: 'Again', hint: '< 1 min' },
  hard: { q: 3, label: 'Hard', hint: 'soon' },
  good: { q: 4, label: 'Good', hint: 'later' },
  easy: { q: 5, label: 'Easy', hint: 'much later' },
};

const MIN_EASE = 1.3;
const DAY = 86400000;
const MINUTE = 60000;

/** Fresh scheduling state for a new card. */
export function newSrs() {
  return {
    ease: 2.5,
    interval: 0,
    due: Date.now(), // due immediately
    reps: 0,
    lapses: 0,
    lastReview: null,
  };
}

/**
 * Apply a rating to a card's srs state. Returns a NEW srs object.
 * @param {object} srs
 * @param {'again'|'hard'|'good'|'easy'} rating
 * @param {number} now
 */
export function schedule(srs, rating, now = Date.now()) {
  const s = { ...(srs || newSrs()) };
  const q = (RATINGS[rating] || RATINGS.good).q;

  if (q < 3) {
    // Failed: relearn soon, reset streak of successful reviews.
    s.lapses += 1;
    s.reps = 0;
    s.interval = 0;
    s.due = now + 1 * MINUTE; // back in the same session shortly
    s.ease = Math.max(MIN_EASE, s.ease - 0.2);
  } else {
    // Update ease factor (SM-2 formula).
    s.ease = Math.max(
      MIN_EASE,
      s.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02))
    );

    if (s.reps === 0) {
      s.interval = 1;
    } else if (s.reps === 1) {
      s.interval = rating === 'hard' ? 3 : 6;
    } else {
      let mult = s.ease;
      if (rating === 'hard') mult = Math.max(1.2, s.ease - 0.4);
      if (rating === 'easy') mult = s.ease + 0.3;
      s.interval = Math.max(1, Math.round(s.interval * mult));
    }

    // "Again"-free but Hard on a brand-new card still means ~1 day.
    if (rating === 'easy' && s.reps === 0) s.interval = 3;

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
