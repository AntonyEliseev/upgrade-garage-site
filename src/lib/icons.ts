// Иконки из макета (stroke-иконки 24×24). Общие для .astro и островков.
export const ICONS = {
  phone: '<path d="M5 4h4l2 5-2.5 1.5a11 11 0 0 0 5 5L15 13l5 2v4a2 2 0 0 1-2 2A16 16 0 0 1 3 6a2 2 0 0 1 2-2"/>',
  tg: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/><path d="m9 13 8-6"/>',
  tgSimple: '<path d="M21 4 3 11l6 2 2 6 3-4 5 4z"/>',
  wa: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/><path d="M9 9.5c.5 2.5 2.5 4.5 5 5l1.2-1.3-2-1-1 1a4 4 0 0 1-2-2l1-1-1-2z"/>',
  waSimple: '<path d="M4 20l1.3-4A8 8 0 1 1 8 18.7z"/>',
  arrow: '<path d="M5 12h14M13 6l6 6-6 6"/>',
  back: '<path d="M15 5l-7 7 7 7"/>',
  up: '<path d="M6 15l6-6 6 6"/>',
  down: '<path d="M6 9l6 6 6-6"/>',
  close: '<path d="M6 6l12 12M18 6L6 18"/>',
  burger: '<path d="M4 7h16M4 12h16M4 17h16"/>',
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  check: '<path d="M5 12.5l4.5 4.5L19 7.5"/>',
  swap: '<path d="M9 6l-6 6 6 6M15 6l6 6-6 6"/>',
  target: '<circle cx="12" cy="12" r="3"/><circle cx="12" cy="12" r="8"/>',
} as const;

export type IconName = keyof typeof ICONS;
