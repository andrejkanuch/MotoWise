// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { buildPopupContent, type PopupWaypoint } from '../trip-detail/popup-content';

// Waypoint names and notes are written by a trip's organiser and shown on every
// public trip page. The popup must render them as text: a regression to
// setHTML or a template string would run an attacker's markup for every reader.

const hostile: PopupWaypoint = {
  lat: 46.5,
  lng: 11.3,
  name: '<img src=x onerror="window.__pwned = 1">',
  type: 'fuel_stop',
  dayIndex: 1,
  sortOrder: 0,
  notes: '<script>window.__pwned = 2</script>',
};

describe('buildPopupContent', () => {
  it('renders organiser text as text, never as markup', () => {
    const root = buildPopupContent(hostile, 3, 2);
    expect(root.querySelector('img, script')).toBeNull();
    expect(root.textContent).toContain(hostile.name);
    expect(root.textContent).toContain(hostile.notes);
  });

  it('shows the stop number, day chip on multi-day trips, and the type in sentence case', () => {
    const root = buildPopupContent({ ...hostile, notes: null }, 3, 2);
    expect(root.textContent).toContain('3');
    expect(root.textContent).toContain('Day 2');
    expect(root.textContent).toContain('Fuel stop');
  });

  it('leaves the day chip out of a one-day trip', () => {
    const root = buildPopupContent({ ...hostile, notes: null }, 1, 1);
    expect(root.textContent).not.toContain('Day ');
  });
});
