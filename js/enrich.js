/* ==========================================================================
   enrich.js — online word lookups (keyless, CORS-friendly)
   --------------------------------------------------------------------------
   Sources:
     • Wiktionary REST        → definitions, part of speech
     • Wikipedia REST         → summary + lead image
     • Wikimedia Commons API  → related images
     • Google Translate (gtx) → primary + alternative translations by POS
     • MyMemory API           → translation fallback
   Results are cached in localStorage to avoid repeat requests.
   ========================================================================== */

const CACHE_KEY = 'recall.lookup.v1';
const TTL = 7 * 24 * 60 * 60 * 1000; // 7 days
const MAX_CACHE = 150;

/* ------------------------------ cache -------------------------------- */

function readCache(key) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    const entry = all[key];
    if (entry && Date.now() - entry.ts < TTL) return entry.data;
  } catch {
    /* ignore */
  }
  return null;
}

function writeCache(key, data) {
  try {
    const all = JSON.parse(localStorage.getItem(CACHE_KEY) || '{}');
    all[key] = { ts: Date.now(), data };
    const keys = Object.keys(all);
    if (keys.length > MAX_CACHE) {
      keys.slice(0, keys.length - MAX_CACHE).forEach((k) => delete all[k]);
    }
    localStorage.setItem(CACHE_KEY, JSON.stringify(all));
  } catch {
    /* storage full or unavailable — ignore */
  }
}

/* ----------------------------- fetching ------------------------------ */

async function fetchJson(url, timeout = 12000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } finally {
    clearTimeout(timer);
  }
}

function stripHtml(html) {
  if (!html) return '';
  try {
    const doc = new DOMParser().parseFromString(String(html), 'text/html');
    return (doc.body.textContent || '').replace(/\s+/g, ' ').trim();
  } catch {
    return String(html).replace(/<[^>]+>/g, '').trim();
  }
}

const norm = (s) =>
  String(s || '')
    .toLowerCase()
    .trim()
    .replace(/[.,;:!?¡¿"'“”‘’()]/g, '');

function cleanList(list, exclude = []) {
  const seen = new Set(exclude.map(norm));
  const out = [];
  for (const raw of list) {
    const value = String(raw || '').trim();
    if (!value) continue;
    const n = norm(value);
    if (!n || seen.has(n)) continue;
    if (value.length > 60) continue;
    if (/^\d+$/.test(value)) continue;
    seen.add(n);
    out.push(value);
  }
  return out;
}

/* --------------------------- definitions ----------------------------- */

export async function lookupDefinitions(term) {
  const url = `https://en.wiktionary.org/api/rest_v1/page/definition/${encodeURIComponent(
    term
  )}`;
  const data = await fetchJson(url);
  const entries = data?.en || data?.es || data?.fr || [];

  return entries.slice(0, 3).map((entry) => ({
    partOfSpeech: entry.partOfSpeech || '',
    language: entry.language || '',
    definitions: (entry.definitions || []).slice(0, 4).map((d) => {
      const example =
        (d.examples && d.examples[0] && stripHtml(d.examples[0])) ||
        (d.parsedExamples &&
          d.parsedExamples[0] &&
          stripHtml(d.parsedExamples[0].example)) ||
        '';
      return { text: stripHtml(d.definition), example };
    }),
  }));
}

/* ----------------------------- summary ------------------------------- */

async function fetchSummary(title) {
  const url = `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title
  )}`;
  const data = await fetchJson(url);
  if (!data || !data.extract) throw new Error('No summary');
  return {
    title: data.title,
    extract: data.extract,
    image: data.thumbnail?.source || data.originalimage?.source || '',
    url: data.content_urls?.desktop?.page || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`,
  };
}

export async function lookupSummary(term) {
  try {
    return await fetchSummary(term);
  } catch {
    // Fall back to Wikipedia search, which handles phrases and near-misses.
    const search = await fetchJson(
      `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
        term
      )}&format=json&origin=*&srlimit=1`
    );
    const title = search?.query?.search?.[0]?.title;
    if (!title) throw new Error('No article');
    return await fetchSummary(title);
  }
}

/* ------------------------------ images ------------------------------- */

function commonsPage(title) {
  return `https://commons.wikimedia.org/wiki/${encodeURI(title.replace(/ /g, '_'))}`;
}

export async function lookupImages(term) {
  const url =
    `https://commons.wikimedia.org/w/api.php?action=query&generator=search` +
    `&gsrsearch=${encodeURIComponent(term + ' filetype:bitmap')}` +
    `&gsrnamespace=6&gsrlimit=5&prop=imageinfo&iiprop=url&iiurlwidth=480` +
    `&format=json&origin=*`;
  const data = await fetchJson(url);
  const pages = Object.values(data?.query?.pages || {});

  return pages
    .map((p) => ({
      thumb: p.imageinfo?.[0]?.thumburl || '',
      full: p.imageinfo?.[0]?.url || '',
      title: p.title || '',
      page: commonsPage(p.title || ''),
    }))
    .filter((img) => img.thumb);
}

/* --------------------------- translations ---------------------------- */

function googleTranslate(term, source, target) {
  const url =
    `https://translate.googleapis.com/translate_a/single?client=gtx` +
    `&sl=${encodeURIComponent(source)}&tl=${encodeURIComponent(target)}` +
    `&dt=t&dt=bd&q=${encodeURIComponent(term)}`;

  return fetchJson(url).then((data) => {
    const primary = (data?.[0] || [])
      .map((part) => (part && part[0]) || '')
      .join('')
      .trim();

    const groups = Array.isArray(data?.[1])
      ? data[1]
          .map((group) => ({
            partOfSpeech: group?.[0] || '',
            translations: cleanList(group?.[1] || [], [term, primary]),
          }))
          .filter((g) => g.translations.length)
      : [];

    if (!primary && !groups.length) throw new Error('No translation');
    return { primary, groups, provider: 'Google Translate' };
  });
}

function myMemoryTranslate(term, source, target) {
  const url = `https://api.mymemory.translated.net/get?q=${encodeURIComponent(
    term
  )}&langpair=${encodeURIComponent(source)}%7C${encodeURIComponent(target)}`;

  return fetchJson(url).then((data) => {
    const primary = String(data?.responseData?.translatedText || '').trim();
    const alternatives = cleanList(
      (data?.matches || [])
        .filter((m) => Number(m.quality) >= 50)
        .map((m) => m.translation),
      [term, primary]
    );
    if (!primary && !alternatives.length) throw new Error('No translation');
    return {
      primary,
      groups: alternatives.length
        ? [{ partOfSpeech: '', translations: alternatives.slice(0, 10) }]
        : [],
      provider: 'MyMemory',
    };
  });
}

export async function lookupTranslations(term, source = 'en', target = 'es') {
  const key = `tr:${term}:${source}:${target}`;
  const cached = readCache(key);
  if (cached) return cached;

  let result;
  try {
    result = await googleTranslate(term, source, target);
  } catch {
    result = await myMemoryTranslate(term, source, target);
  }

  writeCache(key, result);
  return result;
}

/* ------------------------------ combined ----------------------------- */

/**
 * Look up everything we can about a term.
 * Each section is fetched independently; failures are reported per section.
 */
export async function lookup(term, { source = 'en', target = 'es' } = {}) {
  const key = `all:${term}:${source}:${target}`;
  const cached = readCache(key);
  if (cached) return cached;

  const [summary, definitions, images, translations] = await Promise.allSettled([
    lookupSummary(term),
    lookupDefinitions(term),
    lookupImages(term),
    lookupTranslations(term, source, target),
  ]);

  const result = {
    term,
    source,
    target,
    summary: summary.status === 'fulfilled' ? summary.value : null,
    definitions: definitions.status === 'fulfilled' ? definitions.value : [],
    images: images.status === 'fulfilled' ? images.value : [],
    translations: translations.status === 'fulfilled' ? translations.value : null,
    errors: {
      summary: summary.status === 'rejected' ? String(summary.reason?.message || summary.reason) : '',
      definitions:
        definitions.status === 'rejected'
          ? String(definitions.reason?.message || definitions.reason)
          : '',
      images: images.status === 'rejected' ? String(images.reason?.message || images.reason) : '',
      translations:
        translations.status === 'rejected'
          ? String(translations.reason?.message || translations.reason)
          : '',
    },
  };

  // Only cache when we actually got something useful.
  if (result.summary || result.definitions.length || result.translations) {
    writeCache(key, result);
  }
  return result;
}

export function clearLookupCache() {
  try {
    localStorage.removeItem(CACHE_KEY);
  } catch {
    /* ignore */
  }
}
