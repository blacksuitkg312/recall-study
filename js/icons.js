/* ==========================================================================
   icons.js — inline SVG icon set (stroke-based, 24x24 viewBox)
   ========================================================================== */

const wrap = (body, extra = '') =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" ${extra}>${body}</svg>`;

export const icons = {
  logo: wrap('<path d="M4 6h16M4 12h16M4 18h10"/>'),
  plus: wrap('<path d="M12 5v14M5 12h14"/>'),
  search: wrap('<circle cx="11" cy="11" r="7"/><path d="m21 21-4.3-4.3"/>'),
  sun: wrap('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: wrap('<path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z"/>'),
  edit: wrap('<path d="M12 20h9"/><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4z"/>'),
  trash: wrap('<path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/><path d="M10 11v6M14 11v6"/>'),
  copy: wrap('<rect x="9" y="9" width="12" height="12" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>'),
  back: wrap('<path d="M19 12H5M12 19l-7-7 7-7"/>'),
  chevronRight: wrap('<path d="m9 18 6-6-6-6"/>'),
  chevronLeft: wrap('<path d="m15 18-6-6 6-6"/>'),
  play: wrap('<path d="m6 3 15 9-15 9V3z"/>'),
  layers: wrap('<path d="m12 2 9 5-9 5-9-5 9-5z"/><path d="m3 12 9 5 9-5M3 17l9 5 9-5"/>'),
  brain: wrap('<path d="M9.5 2a2.5 2.5 0 0 0-2.5 2.5c0 .5.15 1 .4 1.4A3 3 0 0 0 5 9c0 .5.12 1 .34 1.4A3 3 0 0 0 4 13a3 3 0 0 0 2 2.8V17a3 3 0 0 0 3 3 2.5 2.5 0 0 0 2.5-2.5V4.5A2.5 2.5 0 0 0 9.5 2z"/><path d="M14.5 2A2.5 2.5 0 0 1 17 4.5c0 .5-.15 1-.4 1.4A3 3 0 0 1 19 9c0 .5-.12 1-.34 1.4A3 3 0 0 1 20 13a3 3 0 0 1-2 2.8V17a3 3 0 0 1-3 3 2.5 2.5 0 0 1-2.5-2.5V4.5A2.5 2.5 0 0 1 14.5 2z"/>'),
  clipboard: wrap('<rect x="8" y="2" width="8" height="4" rx="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="M9 12h6M9 16h4"/>'),
  target: wrap('<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/>'),
  zap: wrap('<path d="M13 2 3 14h7l-1 8 10-12h-7l1-8z"/>'),
  flame: wrap('<path d="M12 2c1 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .5-2 1-2.5C9 10 8 12 8 14a4 4 0 0 0 8 0c0-4-4-6-4-12z" transform="translate(0 3) scale(1)"/>'),
  check: wrap('<path d="M20 6 9 17l-5-5"/>'),
  checkCircle: wrap('<circle cx="12" cy="12" r="9"/><path d="m8.5 12 2.5 2.5 4.5-5"/>'),
  x: wrap('<path d="M18 6 6 18M6 6l12 12"/>'),
  xCircle: wrap('<circle cx="12" cy="12" r="9"/><path d="m15 9-6 6M9 9l6 6"/>'),
  shuffle: wrap('<path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5"/>'),
  download: wrap('<path d="M12 3v12M7 10l5 5 5-5"/><path d="M5 21h14"/>'),
  upload: wrap('<path d="M12 21V9M7 14l5-5 5 5"/><path d="M5 3h14"/>'),
  settings: wrap('<circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.7 1.7 0 0 0 .3 1.9l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.7 1.7 0 0 0-1.9-.3 1.7 1.7 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1a1.7 1.7 0 0 0-1-1.6 1.7 1.7 0 0 0-1.9.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.7 1.7 0 0 0 .3-1.9 1.7 1.7 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1a1.7 1.7 0 0 0 1.6-1 1.7 1.7 0 0 0-.3-1.9l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.7 1.7 0 0 0 1.9.3H9a1.7 1.7 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.7 1.7 0 0 0 1 1.6 1.7 1.7 0 0 0 1.9-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.7 1.7 0 0 0-.3 1.9V9a1.7 1.7 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.7 1.7 0 0 0-1.5 1z"/>'),
  clock: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
  cards: wrap('<rect x="3" y="6" width="13" height="15" rx="2"/><path d="M8 3h11a2 2 0 0 1 2 2v11"/>'),
  sparkles: wrap('<path d="M12 3v4M12 17v4M3 12h4M17 12h4"/><path d="m6.3 6.3 2.1 2.1M15.6 15.6l2.1 2.1M17.7 6.3l-2.1 2.1M8.4 15.6l-2.1 2.1"/>'),
  trophy: wrap('<path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M7 5H4v2a3 3 0 0 0 3 3M17 5h3v2a3 3 0 0 1-3 3"/>'),
  book: wrap('<path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/>'),
  grid: wrap('<rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>'),
  keyboard: wrap('<rect x="2" y="6" width="20" height="12" rx="2"/><path d="M6 10h.01M10 10h.01M14 10h.01M18 10h.01M8 14h8"/>'),
  arrowUpRight: wrap('<path d="M7 17 17 7M7 7h10v10"/>'),
  info: wrap('<circle cx="12" cy="12" r="9"/><path d="M12 16v-4M12 8h.01"/>'),
  refresh: wrap('<path d="M21 12a9 9 0 1 1-3-6.7L21 8"/><path d="M21 3v5h-5"/>'),
  flag: wrap('<path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><path d="M4 22v-7"/>'),
};

/** Return an icon's SVG markup by name. */
export function icon(name, cls = '') {
  const svg = icons[name] || icons.info;
  if (!cls) return svg;
  return svg.replace('<svg ', `<svg class="${cls}" `);
}
