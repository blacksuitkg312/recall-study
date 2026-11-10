/* ==========================================================================
   languages.js — language metadata for speech + translation
   ========================================================================== */

export const LANGUAGES = [
  { code: 'en', name: 'English', speech: 'en-US' },
  { code: 'es', name: 'Spanish', speech: 'es-ES' },
  { code: 'fr', name: 'French', speech: 'fr-FR' },
  { code: 'de', name: 'German', speech: 'de-DE' },
  { code: 'it', name: 'Italian', speech: 'it-IT' },
  { code: 'pt', name: 'Portuguese', speech: 'pt-BR' },
  { code: 'nl', name: 'Dutch', speech: 'nl-NL' },
  { code: 'ru', name: 'Russian', speech: 'ru-RU' },
  { code: 'ja', name: 'Japanese', speech: 'ja-JP' },
  { code: 'ko', name: 'Korean', speech: 'ko-KR' },
  { code: 'zh', name: 'Chinese', speech: 'zh-CN' },
  { code: 'ar', name: 'Arabic', speech: 'ar-SA' },
  { code: 'hi', name: 'Hindi', speech: 'hi-IN' },
  { code: 'tr', name: 'Turkish', speech: 'tr-TR' },
  { code: 'pl', name: 'Polish', speech: 'pl-PL' },
  { code: 'sv', name: 'Swedish', speech: 'sv-SE' },
  { code: 'id', name: 'Indonesian', speech: 'id-ID' },
  { code: 'vi', name: 'Vietnamese', speech: 'vi-VN' },
  { code: 'th', name: 'Thai', speech: 'th-TH' },
  { code: 'he', name: 'Hebrew', speech: 'he-IL' },
  { code: 'el', name: 'Greek', speech: 'el-GR' },
  { code: 'uk', name: 'Ukrainian', speech: 'uk-UA' },
  { code: 'ro', name: 'Romanian', speech: 'ro-RO' },
  { code: 'cs', name: 'Czech', speech: 'cs-CZ' },
  { code: 'da', name: 'Danish', speech: 'da-DK' },
  { code: 'fi', name: 'Finnish', speech: 'fi-FI' },
  { code: 'no', name: 'Norwegian', speech: 'nb-NO' },
];

export function langByCode(code) {
  return LANGUAGES.find((l) => l.code === code) || null;
}

/** BCP-47 tag for speech synthesis. Accepts 'es' or 'es-ES'. */
export function speechForCode(code) {
  if (!code) return 'en-US';
  if (code.includes('-')) return code;
  return langByCode(code)?.speech || code;
}

/** Options markup for a language <select>. */
export function languageOptions(selected) {
  return LANGUAGES.map(
    (l) =>
      `<option value="${l.code}" ${l.code === selected ? 'selected' : ''}>${l.name}</option>`
  ).join('');
}
