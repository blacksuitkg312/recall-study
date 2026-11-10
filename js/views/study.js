/* ==========================================================================
   views/study.js — study sessions: flashcards, learn, test, match
   ========================================================================== */

import { store } from '../db.js';
import { icon } from '../icons.js';
import { esc, shuffle, sample, answersMatch, plural, clamp } from '../utils.js';
import { toast, confirmDialog } from '../components.js';
import { schedule, isDue } from '../srs.js';
import { cardToolsHTML, bindCardTools } from '../cardtools.js';

const MODE_META = {
  flashcards: { title: 'Flashcards', icon: 'layers' },
  learn: { title: 'Learn', icon: 'brain' },
  test: { title: 'Test', icon: 'clipboard' },
  match: { title: 'Match', icon: 'grid' },
};

/* ------------------------------ resolution ---------------------------- */

function resolveSet({ id }) {
  if (id === '__due__') {
    const cards = [];
    store.getState().sets.forEach((s) => {
      s.cards.forEach((c) => {
        if (c.term && c.definition && isDue(c.srs)) cards.push(c);
      });
    });
    return {
      set: { id: '__due__', title: 'Due review', cards, accent: '#6366f1' },
      pool: cards,
      synthetic: true,
    };
  }
  const set = store.getSet(id);
  if (!set) return null;
  return { set, pool: set.cards, synthetic: false };
}

/* ------------------------------- shell -------------------------------- */

export function renderStudy(params) {
  const mode = params.mode in MODE_META ? params.mode : 'flashcards';
  const resolved = resolveSet(params);
  if (!resolved) return notFound();

  const { set } = resolved;
  const valid = set.cards.filter((c) => c.term && c.definition);
  const meta = MODE_META[mode];

  if (valid.length < 2) {
    return `
      <main class="page"><div class="container">
        <div class="empty">
          <div class="empty__icon">${icon('cards')}</div>
          <h3>Not enough cards</h3>
          <p>You need at least 2 complete cards (term + definition) to study.</p>
          <a href="#/set/${set.id}" class="btn btn--primary">Back to set</a>
        </div>
      </div></main>`;
  }

  return `
    <main class="page">
      <div class="container">
        <div class="study">
          <div class="study__topbar">
            <a class="iconbtn" href="${resolved.synthetic ? '#/' : `#/set/${set.id}`}" title="Exit" aria-label="Exit study">${icon('back')}</a>
            <div class="study__progress">
              <div class="study__progress-row">
                <span>${icon(meta.icon)} ${meta.title} · ${esc(set.title)}</span>
                <span id="study-counter">starting…</span>
              </div>
              <div class="progress"><div class="progress__fill" id="study-progress" style="width:0%"></div></div>
            </div>
            <button class="iconbtn" id="study-theme" title="Toggle theme" aria-label="Toggle theme">
              ${icon(store.getState().settings.theme === 'dark' ? 'sun' : 'moon')}
            </button>
          </div>
          <div id="study-stage"></div>
        </div>
      </div>
    </main>
  `;
}

export function mountStudy(params) {
  const mode = params.mode in MODE_META ? params.mode : 'flashcards';
  const resolved = resolveSet(params);
  if (!resolved) return;
  const { set, pool } = resolved;
  const valid = set.cards.filter((c) => c.term && c.definition);

  // Theme toggle inside study.
  const themeBtn = document.getElementById('study-theme');
  themeBtn?.addEventListener('click', () => {
    store.toggleTheme();
    themeBtn.innerHTML = icon(store.getState().settings.theme === 'dark' ? 'sun' : 'moon');
  });

  const stage = document.getElementById('study-stage');
  const counter = document.getElementById('study-counter');
  const progress = document.getElementById('study-progress');

  const setProgress = (done, total) => {
    const pct = total ? Math.round((done / total) * 100) : 0;
    if (progress) progress.style.width = `${clamp(pct, 0, 100)}%`;
    if (counter) counter.textContent = `${done} / ${total}`;
  };

  const cleanupFns = [];
  window.__routeCleanup = () => cleanupFns.forEach((fn) => fn());

  const engine = { mode, set, pool, valid, stage, setProgress, cleanupFns };
  if (mode === 'flashcards') startFlashcards(engine);
  else if (mode === 'learn') startLearn(engine);
  else if (mode === 'test') startTest(engine);
  else if (mode === 'match') startMatch(engine);
}

function notFound() {
  return `
    <main class="page"><div class="container">
      <div class="empty">
        <div class="empty__icon">${icon('xCircle')}</div>
        <h3>Set not found</h3>
        <p>It may have been deleted.</p>
        <a href="#/" class="btn btn--primary">Back to library</a>
      </div>
    </div></main>`;
}

/* ============================ FLASHCARDS ============================== */

function startFlashcards({ set, valid, stage, setProgress, cleanupFns }) {
  let order = shuffle(valid);
  let i = 0;
  let flipped = false;
  const reviewed = new Set();

  const render = () => {
    const card = order[i];
    const backHref = set.id === '__due__' ? '#/' : `#/set/${set.id}`;
    setProgress(i + (flipped ? 1 : 0), order.length);

    stage.innerHTML = `
      <div class="flashcard ${flipped ? 'is-flipped' : ''}" id="flashcard" tabindex="0" role="button" aria-label="Flashcard. Click to flip.">
        <div class="flashcard__inner">
          <div class="flashcard__face">
            <span class="flashcard__label">Term</span>
            <div class="flashcard__text">${esc(card.term)}</div>
            <span class="flashcard__hint">Click or press <span class="kbd">Space</span> to flip</span>
          </div>
          <div class="flashcard__face flashcard__face--back">
            <span class="flashcard__label">Definition</span>
            <div class="flashcard__text">${esc(card.definition)}</div>
            <span class="flashcard__hint">How well did you recall it?</span>
          </div>
        </div>
      </div>

      <div class="study-tools">
        <span class="faint">Card ${i + 1} of ${order.length}</span>
        ${cardToolsHTML()}
      </div>

      ${
        flipped
          ? `<div class="rating">
              <button class="rating__btn" data-q="again"><strong>Again</strong><span>&lt; 1 min</span></button>
              <button class="rating__btn" data-q="hard"><strong>Hard</strong><span>soon</span></button>
              <button class="rating__btn" data-q="good"><strong>Good</strong><span>later</span></button>
              <button class="rating__btn" data-q="easy"><strong>Easy</strong><span>much later</span></button>
            </div>`
          : `<div class="study__controls">
              <button class="btn btn--outline" id="prev-btn" ${i === 0 ? 'disabled' : ''}>${icon('chevronLeft')} Prev</button>
              <button class="btn btn--primary" id="flip-btn">${icon('refresh')} Flip</button>
              <button class="btn btn--outline" id="next-btn">${icon('chevronRight')} Next</button>
            </div>`
      }

      <div class="study__controls mt-16" style="justify-content:center">
        <button class="btn btn--ghost btn--sm" id="shuffle-btn">${icon('shuffle')} Shuffle</button>
        <a class="btn btn--ghost btn--sm" href="${backHref}">${icon('x')} End session</a>
      </div>
    `;

    stage.querySelector('#flashcard')?.addEventListener('click', flip);
    stage.querySelector('#flip-btn')?.addEventListener('click', flip);
    stage.querySelector('#prev-btn')?.addEventListener('click', prev);
    stage.querySelector('#next-btn')?.addEventListener('click', next);
    stage.querySelector('#shuffle-btn')?.addEventListener('click', () => {
      order = shuffle(order);
      i = 0;
      flipped = false;
      render();
      toast('Cards shuffled');
    });
    stage.querySelectorAll('[data-q]').forEach((btn) => {
      btn.addEventListener('click', () => rate(btn.dataset.q));
    });

    bindCardTools(stage, {
      card,
      onChanged: render,
      onDeleted: removeCard,
    });
  };

  const removeCard = (card) => {
    const idx = order.indexOf(card);
    if (idx >= 0) order.splice(idx, 1);
    if (!order.length) {
      showSessionEmpty(stage, set);
      return;
    }
    if (i >= order.length) i = order.length - 1;
    flipped = false;
    render();
  };

  const flip = () => {
    flipped = !flipped;
    render();
  };
  const prev = () => {
    if (i > 0) {
      i -= 1;
      flipped = false;
      render();
    }
  };
  const next = () => {
    if (i < order.length - 1) {
      i += 1;
      flipped = false;
      render();
    } else {
      complete();
    }
  };
  const rate = (rating) => {
    const card = order[i];
    card.srs = schedule(card.srs, rating);
    store.recordReview();
    reviewed.add(card.id);
    if (i < order.length - 1) {
      i += 1;
      flipped = false;
      render();
    } else {
      complete();
    }
  };
  const complete = () => {
    setProgress(order.length, order.length);
    showComplete(stage, {
      set,
      mode: 'flashcards',
      title: 'Deck finished',
      subtitle: `You reviewed ${plural(order.length, 'card')}.`,
      stats: [
        { label: 'Cards', value: order.length },
        { label: 'Scheduled', value: reviewed.size },
      ],
    });
  };

  const onKey = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      if (!flipped) flip();
      else next();
    } else if (e.key === 'ArrowLeft') prev();
    else if (e.key === 'ArrowRight') next();
    else if (flipped && ['1', '2', '3', '4'].includes(e.key)) {
      rate(['again', 'hard', 'good', 'easy'][Number(e.key) - 1]);
    }
  };
  document.addEventListener('keydown', onKey);
  cleanupFns.push(() => document.removeEventListener('keydown', onKey));

  render();
}

/* ================================ LEARN =============================== */

function startLearn({ set, pool, valid, stage, setProgress, cleanupFns }) {
  const due = valid.filter((c) => isDue(c.srs));
  const source = due.length ? due : valid;
  let queue = shuffle(source);
  let totalUnique = new Set(queue.map((c) => c.id)).size;
  const mastered = new Set();
  const missed = new Set();
  let correctFirstTry = 0;
  let totalAttempts = 0;
  let removeKey = () => {};
  let cancelFeedback = () => {};
  cleanupFns.push(() => {
    removeKey();
    cancelFeedback();
  });

  const render = () => {
    if (!queue.length) return complete();
    removeKey();
    cancelFeedback();
    const card = queue[0];
    setProgress(mastered.size, totalUnique);

    const { question, options, field } = buildMultipleChoice(card, pool);
    const prompt = field === 'definition' ? 'What is the definition of…' : 'Which term matches…';

    stage.innerHTML = `
      <div class="quiz-card">
        <div class="quiz-card__prompt">${prompt}</div>
        <div class="quiz-card__question">${esc(question)}</div>
        <div class="options" id="options">
          ${options
            .map(
              (opt, idx) => `
            <button class="option" data-value="${esc(opt)}" data-idx="${idx}">
              <span class="option__key">${idx + 1}</span>
              <span>${esc(opt)}</span>
            </button>`
            )
            .join('')}
        </div>
        <div id="feedback"></div>
      </div>
      <div class="study-tools">
        ${cardToolsHTML()}
      </div>
      <div class="study__controls">
        <button class="btn btn--ghost btn--sm" id="end-learn">${icon('x')} End session</button>
        <span class="faint" style="font-size:12px">${due.length ? `${plural(due.length, 'card')} due for review` : 'Learning all cards'}</span>
      </div>
    `;

    let locked = false;
    const onPick = (value, btn) => {
      if (locked) return;
      locked = true;
      removeKey();
      totalAttempts += 1;
      const correctValue = card[field === 'definition' ? 'definition' : 'term'];
      const isCorrect = value === correctValue;

      stage.querySelectorAll('.option').forEach((o) => {
        o.disabled = true;
        if (o.dataset.value === correctValue) o.classList.add('is-correct');
      });
      if (!isCorrect) btn.classList.add('is-wrong');

      if (isCorrect) {
        if (!mastered.has(card.id)) {
          mastered.add(card.id);
          if (!missed.has(card.id)) correctFirstTry += 1;
        }
        card.srs = schedule(card.srs, missed.has(card.id) ? 'hard' : 'good');
        store.recordReview();
        queue.shift();
        cancelFeedback = showFeedback('correct', 'Correct', () => render());
      } else {
        missed.add(card.id);
        card.srs = schedule(card.srs, 'again');
        store.recordReview();
        queue.shift();
        queue.push(card); // revisit later this session
        cancelFeedback = showFeedback('wrong', `Not quite — ${esc(correctValue)}`, () => render());
      }
      setProgress(mastered.size, totalUnique);
    };

    stage.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => onPick(btn.dataset.value, btn));
    });

    bindCardTools(stage, {
      card,
      onChanged: render,
      onDeleted: removeCard,
    });

    const onKey = (e) => {
      const n = Number(e.key);
      if (n >= 1 && n <= options.length) {
        const btn = stage.querySelector(`.option[data-idx="${n - 1}"]`);
        if (btn) onPick(btn.dataset.value, btn);
      }
    };
    document.addEventListener('keydown', onKey);
    removeKey = () => document.removeEventListener('keydown', onKey);

    stage.querySelector('#end-learn')?.addEventListener('click', async () => {
      const ok = await confirmDialog({
        title: 'End this session?',
        message: 'Your progress so far is saved.',
        confirmLabel: 'End session',
      });
      if (ok) location.hash = set.id === '__due__' ? '#/' : `#/set/${set.id}`;
    });
  };

  const complete = () => {
    setProgress(totalUnique, totalUnique);
    const accuracy = totalAttempts ? Math.round((correctFirstTry / totalAttempts) * 100) : 100;
    showComplete(stage, {
      set,
      mode: 'learn',
      title: 'Nice work!',
      subtitle: `You learned ${plural(totalUnique, 'card')} in this session.`,
      stats: [
        { label: 'Cards', value: totalUnique },
        { label: 'First-try accuracy', value: `${accuracy}%` },
        { label: 'Attempts', value: totalAttempts },
      ],
    });
  };

  const removeCard = (card) => {
    queue = queue.filter((c) => c.id !== card.id);
    mastered.delete(card.id);
    missed.delete(card.id);
    const vi = valid.indexOf(card);
    if (vi >= 0) valid.splice(vi, 1);
    const pi = pool.indexOf(card);
    if (pi >= 0) pool.splice(pi, 1);
    totalUnique = mastered.size + new Set(queue.map((c) => c.id)).size;
    if (!queue.length) {
      showSessionEmpty(stage, set);
      return;
    }
    render();
  };

  render();
}

/* ================================= TEST =============================== */

function startTest({ set, pool, valid, stage, setProgress, cleanupFns }) {
  const total = Math.min(valid.length, 20);
  const cards = sample(valid, total);
  const types = ['mc', 'written', 'tf'];
  let i = 0;
  let correct = 0;
  let answered = 0;
  let cancelFeedback = () => {};
  cleanupFns.push(() => cancelFeedback());

  const render = () => {
    cancelFeedback();
    if (i >= cards.length) return complete();
    const card = cards[i];
    const type = types[i % types.length];
    setProgress(i, cards.length);

    if (type === 'mc') renderMC(card);
    else if (type === 'written') renderWritten(card);
    else renderTF(card);
  };

  const submit = (isCorrect, correctText, afterFeedback) => {
    answered += 1;
    if (isCorrect) correct += 1;
    card_srs_update(isCorrect);
    cancelFeedback = showFeedback(isCorrect ? 'correct' : 'wrong', isCorrect ? 'Correct' : `Answer: ${esc(correctText)}`, () => {
      i += 1;
      render();
    });
  };

  let currentCard = null;
  const card_srs_update = (isCorrect) => {
    if (!currentCard) return;
    currentCard.srs = schedule(currentCard.srs, isCorrect ? 'good' : 'again');
    store.recordReview();
  };

  const renderMC = (card) => {
    currentCard = card;
    const { question, options, field } = buildMultipleChoice(card, pool);
    const correctValue = card[field === 'definition' ? 'definition' : 'term'];
    stage.innerHTML = `
      ${testHeader(i, cards.length)}
      <div class="quiz-card">
        <div class="quiz-card__prompt">Multiple choice</div>
        <div class="quiz-card__question">${esc(question)}</div>
        <div class="options">
          ${options
            .map((o, idx) => `<button class="option" data-value="${esc(o)}"><span class="option__key">${idx + 1}</span><span>${esc(o)}</span></button>`)
            .join('')}
        </div>
        <div id="feedback"></div>
      </div>
      <div class="study-tools">${cardToolsHTML()}</div>
    `;
    let locked = false;
    stage.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const ok = btn.dataset.value === correctValue;
        stage.querySelectorAll('.option').forEach((o) => {
          o.disabled = true;
          if (o.dataset.value === correctValue) o.classList.add('is-correct');
        });
        if (!ok) btn.classList.add('is-wrong');
        submit(ok, correctValue);
      });
    });
    bindTestTools(card);
  };

  const renderWritten = (card) => {
    currentCard = card;
    const askDefinition = Math.random() < 0.5;
    const prompt = askDefinition ? card.term : card.definition;
    const expected = askDefinition ? card.definition : card.term;
    stage.innerHTML = `
      ${testHeader(i, cards.length)}
      <div class="quiz-card">
        <div class="quiz-card__prompt">${askDefinition ? 'Type the definition' : 'Type the term'}</div>
        <div class="quiz-card__question">${esc(prompt)}</div>
        <input class="quiz-card__input" id="written-input" placeholder="Your answer…" autocomplete="off" />
        <div class="row gap-8 mt-16" style="justify-content:flex-end">
          <button class="btn btn--primary" id="submit-written">Submit</button>
        </div>
        <div id="feedback"></div>
      </div>
      <div class="study-tools">${cardToolsHTML()}</div>
    `;
    const input = stage.querySelector('#written-input');
    input.focus();
    const check = () => {
      if (input.disabled) return;
      input.disabled = true;
      const ok = answersMatch(input.value, expected);
      if (ok) input.style.borderColor = 'var(--success)';
      else input.style.borderColor = 'var(--danger)';
      submit(ok, expected);
    };
    stage.querySelector('#submit-written')?.addEventListener('click', check);
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') check();
    });
    bindTestTools(card);
  };

  const renderTF = (card) => {
    currentCard = card;
    const others = pool.filter((c) => c.id !== card.id && c.definition);
    const makeTrue = Math.random() < 0.5 || !others.length;
    const shown = makeTrue ? card.definition : sample(others, 1)[0].definition;
    const isTrue = shown === card.definition;
    stage.innerHTML = `
      ${testHeader(i, cards.length)}
      <div class="quiz-card">
        <div class="quiz-card__prompt">True or false</div>
        <div class="quiz-card__question">${esc(card.term)}</div>
        <div style="font-size:17px;padding:16px;border-radius:12px;background:var(--surface-2);border:1px solid var(--border);margin-bottom:20px">
          ${esc(shown)}
        </div>
        <div class="options" style="grid-template-columns:1fr 1fr;display:grid">
          <button class="option" data-val="true"><span class="option__key">T</span><span>True</span></button>
          <button class="option" data-val="false"><span class="option__key">F</span><span>False</span></button>
        </div>
        <div id="feedback"></div>
      </div>
      <div class="study-tools">${cardToolsHTML()}</div>
    `;
    let locked = false;
    stage.querySelectorAll('.option').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (locked) return;
        locked = true;
        const picked = btn.dataset.val === 'true';
        const ok = picked === isTrue;
        stage.querySelectorAll('.option').forEach((o) => (o.disabled = true));
        btn.classList.add(ok ? 'is-correct' : 'is-wrong');
        if (!ok) {
          const correctBtn = stage.querySelector(`.option[data-val="${isTrue}"]`);
          correctBtn?.classList.add('is-correct');
        }
        submit(ok, isTrue ? 'True' : 'False');
      });
    });
    bindTestTools(card);
  };

  const complete = () => {
    setProgress(cards.length, cards.length);
    const pct = answered ? Math.round((correct / answered) * 100) : 0;
    showComplete(stage, {
      set,
      mode: 'test',
      title: pct >= 80 ? 'Great score!' : pct >= 50 ? 'Solid effort' : 'Keep practicing',
      subtitle: `You answered ${correct} of ${answered} correctly.`,
      stats: [
        { label: 'Score', value: `${pct}%` },
        { label: 'Correct', value: correct },
        { label: 'Questions', value: answered },
      ],
    });
  };

  const removeCard = (card) => {
    const idx = cards.indexOf(card);
    if (idx >= 0) cards.splice(idx, 1);
    const vi = valid.indexOf(card);
    if (vi >= 0) valid.splice(vi, 1);
    const pi = pool.indexOf(card);
    if (pi >= 0) pool.splice(pi, 1);
    if (!cards.length || i >= cards.length) return complete();
    render();
  };

  const bindTestTools = (card) => {
    bindCardTools(stage, {
      card,
      onChanged: () => {
        // Don't re-render a question that has already been answered.
        if (!stage.querySelector('.feedback')) render();
      },
      onDeleted: removeCard,
    });
  };

  render();
}

function testHeader(i, total) {
  return `
    <div class="row" style="justify-content:space-between;margin-bottom:14px">
      <span class="chip chip--brand">Question ${i + 1} of ${total}</span>
    </div>`;
}

/* ================================ MATCH =============================== */

function startMatch({ set, valid, stage, setProgress, cleanupFns }) {
  const pairCount = Math.min(6, valid.length);
  const chosen = sample(valid, pairCount);

  const tiles = [];
  chosen.forEach((card) => {
    tiles.push({ cardId: card.id, side: 'term', text: card.term });
    tiles.push({ cardId: card.id, side: 'definition', text: card.definition });
  });
  const board = shuffle(tiles);

  let first = null;
  let matched = 0;
  let moves = 0;
  let startTime = Date.now();
  let timerId = null;
  let lock = false;

  const render = () => {
    setProgress(matched, pairCount);
    stage.innerHTML = `
      <div class="match-stats">
        <span>Time <strong id="match-time">0.0s</strong></span>
        <span>Moves <strong id="match-moves">0</strong></span>
        <span>Pairs <strong id="match-pairs">${matched}/${pairCount}</strong></span>
      </div>
      <div class="match-board" id="match-board">
        ${board
          .map(
            (t, idx) => `
          <button class="match-tile" data-idx="${idx}" data-card="${t.cardId}" data-side="${t.side}">
            ${esc(t.text)}
          </button>`
          )
          .join('')}
      </div>
      <div class="study__controls mt-24">
        <button class="btn btn--ghost btn--sm" id="end-match">${icon('x')} End session</button>
      </div>
    `;

    stage.querySelectorAll('.match-tile').forEach((tile) => {
      tile.addEventListener('click', () => onTile(tile));
    });
    stage.querySelector('#end-match')?.addEventListener('click', async () => {
      const ok = await confirmDialog({ title: 'End this match?', message: 'Your progress is saved.', confirmLabel: 'End match' });
      if (ok) location.hash = set.id === '__due__' ? '#/' : `#/set/${set.id}`;
    });

    updateStats();
  };

  const updateStats = () => {
    const timeEl = document.getElementById('match-time');
    const movesEl = document.getElementById('match-moves');
    const pairsEl = document.getElementById('match-pairs');
    if (timeEl) timeEl.textContent = `${((Date.now() - startTime) / 1000).toFixed(1)}s`;
    if (movesEl) movesEl.textContent = moves;
    if (pairsEl) pairsEl.textContent = `${matched}/${pairCount}`;
  };

  const onTile = (tile) => {
    if (lock || tile.classList.contains('is-matched') || tile.classList.contains('is-selected')) return;
    tile.classList.add('is-selected');

    if (!first) {
      first = tile;
      return;
    }

    moves += 1;
    updateStats();

    const isPair =
      first.dataset.card === tile.dataset.card && first.dataset.side !== tile.dataset.side;

    if (isPair) {
      first.classList.remove('is-selected');
      first.classList.add('is-matched');
      tile.classList.remove('is-selected');
      tile.classList.add('is-matched');
      matched += 1;
      setProgress(matched, pairCount);

      const card = chosen.find((c) => c.id === tile.dataset.card);
      if (card) {
        card.srs = schedule(card.srs, 'good');
        store.recordReview();
      }
      first = null;
      updateStats();

      if (matched === pairCount) finish();
    } else {
      lock = true;
      const a = first;
      const b = tile;
      a.classList.add('is-wrong');
      b.classList.add('is-wrong');
      setTimeout(() => {
        a.classList.remove('is-selected', 'is-wrong');
        b.classList.remove('is-selected', 'is-wrong');
        first = null;
        lock = false;
      }, 450);
    }
  };

  const finish = () => {
    if (timerId) clearInterval(timerId);
    const seconds = (Date.now() - startTime) / 1000;
    setProgress(pairCount, pairCount);
    showComplete(stage, {
      set,
      mode: 'match',
      title: 'All matched!',
      subtitle: `You paired everything in ${seconds.toFixed(1)} seconds.`,
      stats: [
        { label: 'Time', value: `${seconds.toFixed(1)}s` },
        { label: 'Moves', value: moves },
        { label: 'Pairs', value: pairCount },
      ],
    });
  };

  timerId = setInterval(updateStats, 100);
  cleanupFns.push(() => clearInterval(timerId));

  render();
}

/* ============================== HELPERS =============================== */

/** Build a multiple-choice question for a card. */
function buildMultipleChoice(card, pool) {
  const askDefinition = Math.random() < 0.5;
  const field = askDefinition ? 'definition' : 'term';
  const question = askDefinition ? card.term : card.definition;
  const correctValue = card[field];

  const distractors = shuffle(
    pool
      .filter((c) => c.id !== card.id && c[field] && c[field] !== correctValue)
      .map((c) => c[field])
  );
  const unique = [...new Set(distractors)].slice(0, 3);
  const options = shuffle([correctValue, ...unique]);
  return { question, options, field, correctValue };
}

function showFeedback(type, message, onNext) {
  const feedback = document.getElementById('feedback');
  if (!feedback) {
    onNext();
    return () => {};
  }
  let done = false;
  const cancel = () => {
    if (done) return;
    done = true;
    document.removeEventListener('keydown', onKey);
  };
  const next = () => {
    if (done) return;
    done = true;
    document.removeEventListener('keydown', onKey);
    onNext();
  };
  const onKey = (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      next();
    }
  };
  feedback.innerHTML = `
    <div class="feedback feedback--${type}">
      ${icon(type === 'correct' ? 'checkCircle' : 'xCircle')}
      <span>${type === 'correct' ? 'Correct' : message}</span>
      <button class="btn ${type === 'correct' ? 'btn--primary' : 'btn--outline'} btn--sm" id="continue-btn" style="margin-left:auto">
        Continue ${icon('chevronRight')}
      </button>
    </div>
  `;
  const btn = feedback.querySelector('#continue-btn');
  btn.addEventListener('click', next);
  document.addEventListener('keydown', onKey);
  btn.focus();
  return cancel;
}

/** Shown when every card in the current session was deleted. */
function showSessionEmpty(stage, set) {
  const backHref = set.id === '__due__' ? '#/' : `#/set/${set.id}`;
  stage.innerHTML = `
    <div class="empty">
      <div class="empty__icon">${icon('cards')}</div>
      <h3>No cards left</h3>
      <p>All cards in this session were deleted.</p>
      <a href="${backHref}" class="btn btn--primary">${icon('back')} Back to set</a>
    </div>
  `;
  const counter = document.getElementById('study-counter');
  if (counter) counter.textContent = 'Done';
  const bar = document.getElementById('study-progress');
  if (bar) bar.style.width = '100%';
}

/** Full-session completion screen. */
function showComplete(stage, { set, mode, title, subtitle, stats }) {  const backHref = set.id === '__due__' ? '#/' : `#/set/${set.id}`;
  const retryHref = set.id === '__due__' ? '#/due' : `#/study/${set.id}/${mode}`;
  stage.innerHTML = `
    <div class="complete">
      <div class="complete__badge">${icon('trophy')}</div>
      <h2>${esc(title)}</h2>
      <p>${esc(subtitle)}</p>
      <div class="complete__stats">
        ${stats
          .map(
            (s) => `<div class="complete__stat"><strong>${s.value}</strong><span>${esc(s.label)}</span></div>`
          )
          .join('')}
      </div>
      <div class="complete__actions">
        <a href="${retryHref}" class="btn btn--primary">${icon('refresh')} Study again</a>
        <a href="${backHref}" class="btn btn--outline">${icon('back')} Back to set</a>
      </div>
    </div>
  `;
  // Refresh the counter to reflect completion.
  const counter = document.getElementById('study-counter');
  if (counter) counter.textContent = 'Done';
  const bar = document.getElementById('study-progress');
  if (bar) bar.style.width = '100%';
}
