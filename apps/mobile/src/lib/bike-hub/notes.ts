import type { NotesByMotorcycleQuery } from '@motovault/graphql';
import { NOTE_LINK, type NoteLinkKind } from './constants';

type Note = NotesByMotorcycleQuery['notes'][number];

/**
 * The link shown on a note's meta row: its linked task, else its linked
 * expense, else the offer to turn the note into a task.
 */
export function getNoteLink(note: Pick<Note, 'linkedTaskId' | 'linkedExpenseId'>): NoteLinkKind {
  if (note.linkedTaskId) return NOTE_LINK.TASK;
  if (note.linkedExpenseId) return NOTE_LINK.EXPENSE;
  return NOTE_LINK.MAKE_TASK;
}

/** Case-insensitive search over note text. An empty query matches everything. */
export function filterNotes<T extends Pick<Note, 'text'>>(notes: readonly T[], query: string): T[] {
  const needle = query.trim().toLocaleLowerCase();
  if (!needle) return [...notes];
  return notes.filter((note) => note.text.toLocaleLowerCase().includes(needle));
}

/** Text ready to save: trimmed; `null` when there is nothing to save. */
export function normaliseNoteText(text: string): string | null {
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed : null;
}
