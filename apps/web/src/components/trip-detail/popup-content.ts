/**
 * The trip map's stop popup, kept free of mapbox-gl so it can be tested in
 * jsdom (src/components/__tests__/trip-popup-content.test.ts).
 */

export interface PopupWaypoint {
  lat: number;
  lng: number;
  name: string;
  type: string;
  dayIndex: number;
  sortOrder: number;
  notes?: string | null;
}

const POPUP_STYLE = `
  font-family: var(--mv-font-body);
  background: var(--mv-surface-2);
  color: var(--mv-ink);
  padding: 16px;
  border-radius: var(--mv-radius-control);
  border: 1px solid var(--mv-line);
  box-shadow: none;
`;

const POPUP_HEAD_STYLE = 'display: flex; align-items: center; gap: 8px; margin-bottom: 8px;';

const POPUP_NUM_STYLE = `
  width: 24px; height: 24px; border-radius: var(--mv-radius-pill);
  background: var(--mv-surface-3); color: var(--mv-ink);
  display: grid; place-items: center;
  font-family: var(--mv-font-display); font-size: 13px; font-weight: 600;
  font-variant-numeric: tabular-nums;
  flex-shrink: 0;
`;

const POPUP_NAME_STYLE = 'font-size: 15px; font-weight: 600; line-height: 1.45;';

const POPUP_CHIPS_STYLE = `
  display: flex; gap: 6px; flex-wrap: wrap;
  font-size: 13px; line-height: 18px; font-weight: 500;
  letter-spacing: 0;
  color: var(--mv-ink-2);
`;

const POPUP_CHIP_STYLE =
  'background: var(--mv-surface-3); padding: 2px 8px; border-radius: var(--mv-radius-small);';

const POPUP_NOTES_STYLE =
  'font-size: 13px; color: var(--mv-ink-3); margin-top: 8px; line-height: 18px;';

function sentenceCase(s: string): string {
  const words = s.replace(/_/g, ' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

/** A styled element whose text is set through textContent — never markup. */
function el(tag: string, style: string, text?: string): HTMLElement {
  const node = document.createElement(tag);
  node.style.cssText = style;
  if (text !== undefined) node.textContent = text;
  return node;
}

/**
 * The stop popup, built from DOM nodes. Waypoint names and notes are written
 * by the trip's organiser, so they are user data: setting them through
 * textContent is what keeps a `<img onerror>` in a note from running on every
 * reader of a public trip page. Never build this with setHTML.
 */
export function buildPopupContent(wp: PopupWaypoint, num: number, dayCount: number): HTMLElement {
  const root = el('div', POPUP_STYLE);

  const head = el('div', POPUP_HEAD_STYLE);
  head.appendChild(el('span', POPUP_NUM_STYLE, String(num)));
  head.appendChild(el('span', POPUP_NAME_STYLE, wp.name));
  root.appendChild(head);

  const chips = el('div', POPUP_CHIPS_STYLE);
  if (dayCount > 1) chips.appendChild(el('span', POPUP_CHIP_STYLE, `Day ${wp.dayIndex + 1}`));
  chips.appendChild(el('span', POPUP_CHIP_STYLE, sentenceCase(wp.type)));
  root.appendChild(chips);

  if (wp.notes) root.appendChild(el('div', POPUP_NOTES_STYLE, wp.notes));

  return root;
}
