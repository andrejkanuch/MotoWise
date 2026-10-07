import { NOTE_LINK } from '../constants';
import { hasOdometer, midSentence } from '../format';
import { filterNotes, getNoteLink, normaliseNoteText } from '../notes';

describe('midSentence', () => {
  it('lower-cases a category name placed mid-sentence', () => {
    expect(midSentence('Insurance', 'en')).toBe('insurance');
    expect(midSentence('Seguro', 'es')).toBe('seguro');
    expect(midSentence('My Papers', 'en-US')).toBe('my papers');
  });

  it('keeps the capital in languages that capitalise nouns', () => {
    expect(midSentence('Versicherung', 'de')).toBe('Versicherung');
    expect(midSentence('Versicherung', 'de-AT')).toBe('Versicherung');
  });

  it('uses the locale’s own casing rules', () => {
    expect(midSentence('SİGORTA', 'tr')).toBe('sigorta');
  });
});

describe('notes helpers', () => {
  const notes = [
    { text: 'Front tyre pressure that feels right loaded: 2.5 bar.' },
    { text: 'Heated grips before winter' },
  ];

  it('search is case-insensitive and an empty query matches everything', () => {
    expect(filterNotes(notes, '2.5 BAR')).toEqual([notes[0]]);
    expect(filterNotes(notes, '  ')).toHaveLength(2);
    expect(filterNotes(notes, 'chain')).toEqual([]);
  });

  it('picks the link: task, then expense, else "make it a task"', () => {
    const none = { linkedTaskId: null, linkedTaskTitle: null, linkedExpenseId: null };
    expect(
      getNoteLink({ ...none, linkedTaskId: 't', linkedTaskTitle: 'Oil', linkedExpenseId: 'e' }),
    ).toBe(NOTE_LINK.TASK);
    expect(getNoteLink({ ...none, linkedExpenseId: 'e' })).toBe(NOTE_LINK.EXPENSE);
    expect(getNoteLink(none)).toBe(NOTE_LINK.MAKE_TASK);
  });

  it('a task id without a title (the task is gone) offers "make it a task" again', () => {
    expect(getNoteLink({ linkedTaskId: 't', linkedTaskTitle: null, linkedExpenseId: null })).toBe(
      NOTE_LINK.MAKE_TASK,
    );
    // …and a linked expense still wins over the dead task link.
    expect(getNoteLink({ linkedTaskId: 't', linkedTaskTitle: null, linkedExpenseId: 'e' })).toBe(
      NOTE_LINK.EXPENSE,
    );
  });

  it('normalises text: trimmed, or null when there is nothing to save', () => {
    expect(normaliseNoteText('  hello  ')).toBe('hello');
    expect(normaliseNoteText(' \n ')).toBeNull();
  });
});

describe('hasOdometer', () => {
  it('treats null, undefined and 0 as "not set"', () => {
    expect(hasOdometer(null)).toBe(false);
    expect(hasOdometer(undefined)).toBe(false);
    expect(hasOdometer(0)).toBe(false);
    expect(hasOdometer(1)).toBe(true);
    expect(hasOdometer(38_167)).toBe(true);
  });
});
