/**
 * Where a diagnosis started (#365 T05b, FS-PO2d): the `entry` property of
 * `diagnostic_started`, and the route param that carries it.
 */
export const DIAGNOSTIC_ENTRY = {
  /** "Start" on the diagnose list. */
  LIST: 'list',
  /** "Try again" on a failed or stuck diagnosis. */
  DETAIL: 'detail',
  /** The home-screen quick action, which opens the form directly. */
  QUICK_ACTION: 'quick_action',
  /** "Start" on the diagnose list, reached from the Home "Diagnose" tool. */
  HOME_TOOL: 'home_tool',
} as const;

export type DiagnosticEntry = (typeof DIAGNOSTIC_ENTRY)[keyof typeof DIAGNOSTIC_ENTRY];

/**
 * Route param carrying the entry: on the form, set by `useStartDiagnosis` (the
 * start is already counted there); on the list, set by the Home tool.
 */
export const DIAGNOSTIC_ENTRY_PARAM = 'entry' as const;
