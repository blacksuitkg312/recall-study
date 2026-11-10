/* ==========================================================================
   speech.js — pronunciation via the Web Speech API (no network, no key)
   ========================================================================== */

import { speechForCode } from './languages.js';

let cachedVoices = [];

function loadVoices() {
  try {
    cachedVoices = window.speechSynthesis?.getVoices() || [];
  } catch {
    cachedVoices = [];
  }
  return cachedVoices;
}

export function isSpeechSupported() {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

/** Choose the best installed voice for a language tag. */
function pickVoice(tag) {
  if (!cachedVoices.length) loadVoices();
  const norm = (s) => (s || '').replace('_', '-').toLowerCase();
  const target = norm(tag);
  const base = target.split('-')[0];

  return (
    cachedVoices.find((v) => norm(v.lang) === target) ||
    cachedVoices.find((v) => norm(v.lang).startsWith(base + '-')) ||
    cachedVoices.find((v) => norm(v.lang) === base) ||
    cachedVoices.find((v) => norm(v.lang).startsWith(base)) ||
    null
  );
}

/**
 * Speak text aloud.
 * @param {string} text
 * @param {string} langCode language code ('es') or BCP-47 tag ('es-ES')
 * @returns {boolean} whether speech was started
 */
export function speak(text, langCode = 'en') {
  if (!isSpeechSupported() || !text) return false;
  const synth = window.speechSynthesis;
  const tag = speechForCode(langCode);

  try {
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(String(text));
    utterance.lang = tag;
    utterance.rate = 0.92;
    utterance.pitch = 1;
    const voice = pickVoice(tag);
    if (voice) utterance.voice = voice;
    synth.speak(utterance);
    return true;
  } catch {
    return false;
  }
}

export function stopSpeaking() {
  if (isSpeechSupported()) {
    try {
      window.speechSynthesis.cancel();
    } catch {
      /* ignore */
    }
  }
}

if (isSpeechSupported()) {
  loadVoices();
  // Voices can load asynchronously.
  window.speechSynthesis.addEventListener?.('voiceschanged', loadVoices);
}
