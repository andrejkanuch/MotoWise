import { describe, expect, it } from 'vitest';
import {
  deriveTaskTitleFromNote,
  NOTE_TASK_TITLE_FALLBACK,
  NOTE_TASK_TITLE_MAX,
} from '../note-task-title';

describe('deriveTaskTitleFromNote', () => {
  it.each([
    [
      'cuts at an em dash (fixture note)',
      'Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.',
      'Rear preload felt soft two-up on the Pyrenees run',
    ],
    ['cuts at the first sentence end', 'Check rear sag. Then book the dealer.', 'Check rear sag'],
    ['cuts at a spaced hyphen', 'Chain is noisy - lube it', 'Chain is noisy'],
    ['keeps a hyphen inside a word', 'Check two-up preload', 'Check two-up preload'],
    [
      'keeps a decimal point inside a number',
      'Front tyre pressure 2.5 bar cold',
      'Front tyre pressure 2.5 bar cold',
    ],
    ['uses only the first line', 'Heated grips\nOxford or Koso?', 'Heated grips'],
    ['skips leading blank lines', '\n\n  Replace mirror  \nleft side', 'Replace mirror'],
    ['cuts at a question mark', 'Heated grips? Maybe next winter', 'Heated grips'],
    ['keeps a line that opens with a dash', '- buy 10W-40 oil', 'buy 10W-40 oil'],
    ['falls back when nothing is left', '—', NOTE_TASK_TITLE_FALLBACK],
  ])('%s', (_label, text, expected) => {
    expect(deriveTaskTitleFromNote(text)).toBe(expected);
  });

  it('truncates to 60 characters with an ellipsis', () => {
    const title = deriveTaskTitleFromNote(
      'Dealer said the steering head bearings are notchy and need replacing before winter',
    );
    expect(title.length).toBeLessThanOrEqual(NOTE_TASK_TITLE_MAX);
    expect(title.endsWith('…')).toBe(true);
    expect(title).toBe('Dealer said the steering head bearings are notchy and need…');
  });

  it('leaves a title of exactly 60 characters alone', () => {
    const text = 'a'.repeat(NOTE_TASK_TITLE_MAX);
    expect(deriveTaskTitleFromNote(text)).toBe(text);
  });

  it('counts code points: an emoji title of exactly 60 is left alone', () => {
    const text = '🏍'.repeat(NOTE_TASK_TITLE_MAX); // 120 UTF-16 units
    expect(deriveTaskTitleFromNote(text)).toBe(text);
  });

  it('truncates by code points and never splits a surrogate pair', () => {
    const title = deriveTaskTitleFromNote(`a${'🏍'.repeat(NOTE_TASK_TITLE_MAX)}`);
    const characters = Array.from(title);
    expect(characters).toHaveLength(NOTE_TASK_TITLE_MAX);
    expect(characters[characters.length - 1]).toBe('…');
    expect(title).toBe(`a${'🏍'.repeat(NOTE_TASK_TITLE_MAX - 2)}…`);
  });
});
