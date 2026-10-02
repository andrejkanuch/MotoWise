/** Longest task title derived from a note, ellipsis included (API task + Note sheet preview). */
export const NOTE_TASK_TITLE_MAX = 60;

const ELLIPSIS = '…';
const FALLBACK_TITLE = 'Note';

/**
 * Where the first clause of a line ends: sentence punctuation followed by a
 * space or the end of the line, an em/en dash, or a spaced hyphen. A dot inside
 * a number ("2.5 bar") and a hyphen inside a word ("two-up") are not breaks.
 */
const CLAUSE_BREAK = /[.!?](?=\s|$)|\s*[—–]|\s+-\s/;

/**
 * Deterministic task title for "also make it a task": the first line of the
 * note, cut at its first sentence end or dash, at most 60 characters.
 */
export function deriveTaskTitleFromNote(text: string): string {
  const firstLine =
    text
      .split('\n')
      .map((line) => line.trim())
      .find((line) => line.length > 0) ?? '';
  // A line that opens with a break ("- buy oil") has no clause before it: keep the line.
  const clause = firstLine.split(CLAUSE_BREAK)[0].trim() || firstLine;
  const title = clause.replace(/^[-—–\s]+/, '').trim() || FALLBACK_TITLE;
  if (title.length <= NOTE_TASK_TITLE_MAX) return title;
  return `${title.slice(0, NOTE_TASK_TITLE_MAX - ELLIPSIS.length).trimEnd()}${ELLIPSIS}`;
}
