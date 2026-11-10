/**
 * smoke.mjs — headless end-to-end smoke test using the Chrome DevTools Protocol.
 *
 * No dependencies: uses Node's built-in fetch and WebSocket (Node 21+).
 *
 * Usage:
 *   node scripts/smoke.mjs [url]
 *
 * Requires the dev server to already be running (npm start) and Chrome/Edge
 * installed at a standard Windows location.
 */
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const URL = process.argv[2] || 'http://localhost:4173/';

const CANDIDATES = [
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
];

const browserPath = CANDIDATES.find((p) => fs.existsSync(p));
if (!browserPath) {
  console.error('No Chrome/Edge found.');
  process.exit(1);
}

const profile = fs.mkdtempSync(path.join(os.tmpdir(), 'recall-smoke-'));
const chrome = spawn(
  browserPath,
  [
    '--headless=new',
    '--disable-gpu',
    '--no-sandbox',
    '--no-first-run',
    '--no-default-browser-check',
    '--remote-debugging-port=0', // let Chrome pick a free port
    `--user-data-dir=${profile}`,
    '--window-size=1440,1000',
    'about:blank',
  ],
  { stdio: 'ignore' }
);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function killBrowser() {
  try {
    if (process.platform === 'win32') {
      spawn('taskkill', ['/PID', String(chrome.pid), '/T', '/F'], { stdio: 'ignore' });
    } else {
      chrome.kill('SIGKILL');
    }
  } catch {
    /* ignore */
  }
  setTimeout(() => {
    try {
      fs.rmSync(profile, { recursive: true, force: true });
    } catch {
      /* ignore */
    }
  }, 500);
}

/** Wait for Chrome to write DevToolsActivePort, then return its port. */
async function getDebugPort() {
  const portFile = path.join(profile, 'DevToolsActivePort');
  for (let i = 0; i < 100; i++) {
    try {
      const raw = fs.readFileSync(portFile, 'utf8').split('\n');
      const port = Number(raw[0]);
      if (port) return port;
    } catch {
      /* not ready yet */
    }
    await sleep(100);
  }
  throw new Error('Timed out waiting for DevToolsActivePort.');
}

async function getTarget(port) {
  for (let i = 0; i < 60; i++) {
    try {
      const res = await fetch(`http://127.0.0.1:${port}/json/list`);
      const list = await res.json();
      const page = list.find((t) => t.type === 'page');
      if (page && page.webSocketDebuggerUrl) return page;
    } catch {
      /* not ready yet */
    }
    await sleep(200);
  }
  throw new Error('Timed out waiting for the browser debugging endpoint.');
}

function cdpClient(wsUrl) {
  const ws = new WebSocket(wsUrl);
  let nextId = 1;
  const pending = new Map();
  const listeners = new Map();

  const ready = new Promise((resolve, reject) => {
    ws.addEventListener('open', resolve);
    ws.addEventListener('error', reject);
  });

  ws.addEventListener('message', (event) => {
    const msg = JSON.parse(event.data);
    if (msg.id && pending.has(msg.id)) {
      const { resolve, reject } = pending.get(msg.id);
      pending.delete(msg.id);
      if (msg.error) reject(new Error(msg.error.message));
      else resolve(msg.result);
    } else if (msg.method) {
      (listeners.get(msg.method) || []).forEach((fn) => fn(msg.params));
    }
  });

  return {
    ready,
    send(method, params = {}) {
      const id = nextId++;
      return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject });
        ws.send(JSON.stringify({ id, method, params }));
      });
    },
    on(method, fn) {
      if (!listeners.has(method)) listeners.set(method, []);
      listeners.get(method).push(fn);
    },
    close() {
      ws.close();
    },
  };
}

async function main() {
  const port = await getDebugPort();
  const target = await getTarget(port);
  const client = cdpClient(target.webSocketDebuggerUrl);
  await client.ready;

  const consoleErrors = [];
  client.on('Runtime.exceptionThrown', (p) => {
    const d = p.exceptionDetails;
    consoleErrors.push(
      d?.exception?.description || d?.text || 'Unknown exception'
    );
  });
  client.on('Runtime.consoleAPICalled', (p) => {
    if (p.type === 'error') {
      consoleErrors.push(p.args.map((a) => a.value ?? a.description ?? '').join(' '));
    }
  });
  client.on('Log.entryAdded', (p) => {
    if (p.entry.level === 'error') consoleErrors.push(p.entry.text);
  });

  await client.send('Runtime.enable');
  await client.send('Log.enable');
  await client.send('Page.enable');
  await client.send('Page.navigate', { url: URL });
  await sleep(1000);

  // Wait for the ES module graph to boot (cold caches can take a few seconds).
  let booted = false;
  for (let i = 0; i < 100; i++) {
    try {
      const ready = await client.send('Runtime.evaluate', {
        expression: '!!(window.__recall && window.__recall.store)',
        returnByValue: true,
      });
      if (ready.result?.value) {
        booted = true;
        break;
      }
    } catch {
      /* page not ready yet */
    }
    await sleep(200);
  }

  if (!booted) {
    console.error('The app did not boot within 20 seconds.');
    if (consoleErrors.length) {
      console.error('Runtime errors:');
      consoleErrors.forEach((e) => console.error('  - ' + e));
    }
    try {
      await client.send('Browser.close');
    } catch {
      /* ignore */
    }
    client.close();
    killBrowser();
    process.exit(1);
  }

  const expr = `
    (async () => {
      const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
      const report = { steps: [], errors: [] };
      const check = (name, ok, extra) => report.steps.push({ name, ok: !!ok, extra: extra || '' });

      try {
        const store = window.__recall.store;
        store.resetAll();
        await sleep(200);

        // Empty state should offer a one-click sample deck.
        check('empty state offers sample', !!document.querySelector('#sample-btn'));
        document.querySelector('#sample-btn')?.click();
        await sleep(400);
        check('sample sets load', store.getState().sets.length === 2, 'sets=' + store.getState().sets.length);
        store.resetAll();
        await sleep(150);

        const set = store.createSet({
          title: 'Spanish Basics',
          description: 'Automated test set',
          cards: [
            { term: 'hola', definition: 'hello' },
            { term: 'adios', definition: 'goodbye' },
            { term: 'gato', definition: 'cat' },
            { term: 'perro', definition: 'dog' },
          ],
        });

        window.dispatchEvent(new HashChangeEvent('hashchange'));
        await sleep(400);
        check('dashboard renders set', document.body.textContent.includes('Spanish Basics'));
        check('boot screen gone', !document.querySelector('.boot'));
        check('theme toggle present', !!document.querySelector('#theme-toggle'));

        location.hash = '#/set/' + set.id;
        await sleep(400);
        check('set page title', (document.querySelector('.set-hero h1')||{}).textContent?.includes('Spanish Basics'));
        check('four study modes', document.querySelectorAll('.mode-card').length >= 4);
        check('term rows', document.querySelectorAll('.term-row').length === 4);

        location.hash = '#/study/' + set.id + '/learn';
        await sleep(400);
        check('learn shows options', document.querySelectorAll('.option').length >= 2);
        document.querySelector('.option')?.click();
        await sleep(250);
        check('learn shows feedback', !!document.querySelector('.feedback'));
        document.querySelector('#continue-btn')?.click();
        await sleep(250);
        check('learn advances', document.querySelectorAll('.option').length >= 2);

        location.hash = '#/study/' + set.id + '/flashcards';
        await sleep(400);
        check('flashcard renders', !!document.querySelector('#flashcard'));
        document.querySelector('#flip-btn')?.click();
        await sleep(250);
        check('flashcard flips', document.querySelector('#flashcard')?.classList.contains('is-flipped'));
        check('four rating buttons', document.querySelectorAll('.rating__btn').length === 4);
        document.querySelector('[data-q="good"]')?.click();
        await sleep(250);

        // Pronunciation + in-session edit/delete
        check('study card tools present', document.querySelectorAll('.study-tools .card-tool').length >= 3);
        check('pronounce button present', !!document.querySelector('.study-tools [data-tool="speak"]'));

        document.querySelector('.study-tools [data-tool="edit"]')?.click();
        await sleep(300);
        check('card editor opens from study', !!document.querySelector('#ce-term'));
        if (document.querySelector('#ce-term')) {
          document.querySelector('#ce-term').value = 'edited-in-session';
          document.querySelector('.modal__actions [data-action="2"]')?.click();
        }
        await sleep(400);
        check('in-session edit saves', store.getSet(set.id).cards.some((c) => c.term === 'edited-in-session'));
        check('edited card shown in session', document.body.textContent.includes('edited-in-session'));

        const beforeSessionDelete = store.getSet(set.id).cards.length;
        document.querySelector('.study-tools [data-tool="delete"]')?.click();
        await sleep(300);
        check('delete confirmation opens', !!document.querySelector('.modal'));
        document.querySelector('.modal__actions [data-action="1"]')?.click();
        await sleep(400);
        check(
          'in-session delete removes card',
          store.getSet(set.id).cards.length === beforeSessionDelete - 1
        );
        check(
          'session continues after delete',
          !!document.querySelector('#flashcard') || document.body.textContent.includes('No cards left')
        );

        location.hash = '#/study/' + set.id + '/test';
        await sleep(400);
        check('test question renders', !!document.querySelector('.quiz-card__question'));

        location.hash = '#/study/' + set.id + '/match';
        await sleep(400);
        check('match board renders', document.querySelectorAll('.match-tile').length >= 4);

        // Set-page card tools (pronounce / info / edit / delete)
        location.hash = '#/set/' + set.id;
        await sleep(400);
        const setCards = store.getSet(set.id).cards;
        check(
          'term rows have card tools',
          document.querySelectorAll('.term-row .card-tool').length === setCards.length * 4
        );
        check(
          'term row speaker present',
          document.querySelectorAll('.term-row [data-tool="speak"]').length === setCards.length
        );

        const row = document.querySelector('.term-row');
        const rowCardId = row?.dataset.cardId;
        row?.querySelector('[data-tool="edit"]')?.click();
        await sleep(300);
        check('card editor opens from set', !!document.querySelector('#ce-term'));
        if (document.querySelector('#ce-term')) {
          document.querySelector('#ce-term').value = 'set-edited';
          document.querySelector('.modal__actions [data-action="2"]')?.click();
        }
        await sleep(400);
        check(
          'set edit saves',
          store.getSet(set.id).cards.some((c) => c.id === rowCardId && c.term === 'set-edited')
        );

        const beforeSetDelete = store.getSet(set.id).cards.length;
        document
          .querySelector('.term-row[data-card-id="' + rowCardId + '"] [data-tool="delete"]')
          ?.click();
        await sleep(300);
        check('set delete confirmation opens', !!document.querySelector('.modal'));
        document.querySelector('.modal__actions [data-action="1"]')?.click();
        await sleep(400);
        check(
          'set delete removes card',
          store.getSet(set.id).cards.length === beforeSetDelete - 1
        );

        // Word info panel — seed the lookup cache so this test is deterministic.
        const wiCard = store.getSet(set.id).cards[0];
        const wiSettings = store.getState().settings;
        const wiSource = wiSettings.sourceLang || 'en';
        const wiTarget = wiSettings.targetLang || 'es';
        const lookupCache = JSON.parse(localStorage.getItem('recall.lookup.v1') || '{}');
        lookupCache['all:' + wiCard.term + ':' + wiSource + ':' + wiTarget] = {
          ts: Date.now(),
          data: {
            term: wiCard.term,
            source: wiSource,
            target: wiTarget,
            summary: {
              title: 'Test article',
              extract: 'A deterministic test summary.',
              image: '',
              url: 'https://example.com',
            },
            definitions: [
              {
                partOfSpeech: 'noun',
                language: 'English',
                definitions: [{ text: 'A deterministic definition.', example: '' }],
              },
            ],
            images: [
              {
                thumb:
                  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
                full: '',
                title: 'Test image',
                page: 'https://example.com',
              },
            ],
            translations: {
              primary: 'prueba',
              groups: [{ partOfSpeech: 'noun', translations: ['prueba', 'ensayo'] }],
              provider: 'Test',
            },
            errors: { summary: '', definitions: '', images: '', translations: '' },
          },
        };
        localStorage.setItem('recall.lookup.v1', JSON.stringify(lookupCache));

        document.querySelector('.term-row [data-tool="info"]')?.click();
        await sleep(500);
        check('word info modal opens', !!document.querySelector('.wi'));
        check(
          'word info sections present',
          !!document.querySelector('#wi-summary') &&
            !!document.querySelector('#wi-defs') &&
            !!document.querySelector('#wi-trans') &&
            !!document.querySelector('#wi-images')
        );
        check(
          'word info language pickers',
          !!document.querySelector('#wi-from') && !!document.querySelector('#wi-to')
        );
        check('word info pronounce button', !!document.querySelector('#wi-speak'));
        check('word info summary renders', document.body.textContent.includes('A deterministic test summary.'));
        check(
          'word info definitions render',
          document.body.textContent.includes('A deterministic definition.')
        );
        check('word info translations render', !!document.querySelector('.wi-primary'));
        check('word info images render', !!document.querySelector('.wi-thumb'));
        const wiActions = document.querySelectorAll('.modal__actions [data-action]');
        wiActions[wiActions.length - 1]?.click();
        await sleep(250);

        // Settings exposes pronunciation + online lookup controls.
        document.querySelector('#settings-btn')?.click();
        await sleep(300);
        check('settings has pronunciation language', !!document.querySelector('#st-speech'));
        check('settings has online toggle', !!document.querySelector('#st-online'));
        document.querySelector('.modal__actions [data-action="0"]')?.click();
        await sleep(250);

        location.hash = '#/progress';
        await sleep(400);
        check('progress page renders', document.body.textContent.includes('Your progress'));

        location.hash = '#/new';
        await sleep(400);
        check('editor renders', !!document.querySelector('#set-title'));

        // Save a brand-new set through the editor UI.
        document.querySelector('#set-title').value = 'Editor Test Set';
        const firstRow = document.querySelector('.card-editor');
        firstRow.querySelector('[data-field="term"]').value = 'uno';
        firstRow.querySelector('[data-field="definition"]').value = 'one';
        document.querySelector('#save-btn')?.click();
        await sleep(500);
        check('editor saves a new set', document.body.textContent.includes('Editor Test Set'));

        // Export produces valid JSON.
        const exported = store.exportData();
        let exportOk = false;
        try {
          exportOk = Array.isArray(JSON.parse(exported).sets);
        } catch {
          exportOk = false;
        }
        check('export produces valid JSON', exportOk);

        location.hash = '#/due';
        await sleep(400);
        check('due route handled', !!document.querySelector('#study-stage') || document.body.textContent.includes('Due review') || document.body.textContent.includes('Not enough cards'));

        const state = store.getState();
        check('reviews recorded (xp > 0)', state.activity.xp > 0, 'xp=' + state.activity.xp);
        check('sets persisted', state.sets.length === 2, 'sets=' + state.sets.length);
        report.summary = { xp: state.activity.xp, streak: state.activity.streak, studiedToday: store.studiedToday() };
      } catch (err) {
        report.errors.push(String(err && err.stack || err));
      }
      return report;
    })()
  `;

  const result = await client.send('Runtime.evaluate', {
    expression: expr,
    awaitPromise: true,
    returnByValue: true,
  });

  const report = result.result?.value;
  try {
    await client.send('Browser.close');
  } catch {
    /* ignore */
  }
  client.close();
  killBrowser();

  if (!report) {
    console.error('No report returned from the page.');
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  let failures = 0;
  for (const step of report.steps) {
    if (!step.ok) failures++;
    console.log(`${step.ok ? 'PASS' : 'FAIL'}  ${step.name}${step.extra ? `  (${step.extra})` : ''}`);
  }
  if (report.summary) console.log('Summary:', JSON.stringify(report.summary));

  const allErrors = [...consoleErrors, ...(report.errors || [])];
  if (allErrors.length) {
    console.log('\nRuntime errors:');
    allErrors.forEach((e) => console.log('  - ' + e));
    failures += allErrors.length;
  }

  console.log(`\n${report.steps.filter((s) => s.ok).length}/${report.steps.length} checks passed.`);
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error('Smoke test crashed:', err);
  killBrowser();
  process.exit(1);
});
