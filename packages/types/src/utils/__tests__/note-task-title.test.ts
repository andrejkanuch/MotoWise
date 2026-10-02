import { describe, expect, it } from 'vitest';
import { deriveTaskTitleFromNote, NOTE_TASK_TITLE_MAX } from '../note-task-title';

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
    ['falls back when nothing is left', '—', 'Note'],
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
});
