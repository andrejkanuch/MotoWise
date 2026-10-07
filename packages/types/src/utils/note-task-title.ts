/** Longest task title derived from a note, ellipsis included (API task + Note sheet preview). */
export const NOTE_TASK_TITLE_MAX = 60;

const ELLIPSIS = '…';
/**
 * The title when a note has no words to take one from. English, because the API
 * derives the same title; a client compares against it to show its own copy.
 */
export const NOTE_TASK_TITLE_FALLBACK = 'Note';

/**
 * Where the first clause of a line ends: sentence punctuation followed by a
 * space or the end of the line, an em/en dash, or a spaced hyphen. A dot inside
 * a number ("2.5 bar") and a hyphen inside a word ("two-up") are not breaks.
 */
const CLAUSE_BREAK = /[.!?](?=\s|$)|\s*[—–]|\s+-\s/;

/**
 * Deterministic task title for "also make it a task": the first line of the
 * note, cut at its first sentence end or dash, at most 60 characters —
 * counted in code points, so an emoji or other astral character is never cut
 * in half.
 */
export function deriveTaskTitleFromNote(text: string): string {
  const firstLine =
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  // A line that opens with a break ("- buy oil") has no clause before it: keep the line.
  const clause = firstLine.split(CLAUSE_BREAK)[0].trim() || firstLine;
  const title = clause.replace(/^[-—–\s]+/, '').trim() || NOTE_TASK_TITLE_FALLBACK;
  const characters = Array.from(title);
  if (characters.length <= NOTE_TASK_TITLE_MAX) return title;
  const kept = characters.slice(0, NOTE_TASK_TITLE_MAX - Array.from(ELLIPSIS).length).join('');
  return `${kept.trimEnd()}${ELLIPSIS}`;
}
