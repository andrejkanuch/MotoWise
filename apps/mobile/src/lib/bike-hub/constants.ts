/**
 * Typed constants of the bike hub (bike-detail redesign). Pure data — no React,
 * no i18n. Every id used across the hub (segments, origins, statuses, kinds)
 * lives here so nothing compares against a bare string.
 */

export const BIKE_SEGMENT = {
  OVERVIEW: 'overview',
  SERVICE: 'service',
  COSTS: 'costs',
  BIKE: 'bike',
} as const;
export type BikeSegment = (typeof BIKE_SEGMENT)[keyof typeof BIKE_SEGMENT];

/** Left-to-right order of the segment bar. */
export const BIKE_SEGMENT_ORDER = [
  BIKE_SEGMENT.OVERVIEW,
  BIKE_SEGMENT.SERVICE,
  BIKE_SEGMENT.COSTS,
  BIKE_SEGMENT.BIKE,
] as const satisfies readonly BikeSegment[];

/** Where the bike screen was opened from — drives the back destination and label. */
export const BIKE_ORIGIN = {
  GARAGE: 'garage',
  HOME: 'home',
  PROFILE: 'profile',
} as const;
export type BikeOrigin = (typeof BIKE_ORIGIN)[keyof typeof BIKE_ORIGIN];

export const RIDE_STATUS = {
  NOT_READY: 'not_ready',
  CHECK: 'check',
  READY: 'ready',
  UNTRACKED: 'untracked',
} as const;
export type RideStatus = (typeof RIDE_STATUS)[keyof typeof RIDE_STATUS];

export const RIDE_STATUS_REASON = {
  OVERDUE_CRITICAL: 'overdue_critical',
  DOCUMENT_EXPIRED: 'document_expired',
  OPEN_RECALLS: 'open_recalls',
  OVERDUE_HIGH: 'overdue_high',
  DOCUMENT_EXPIRING: 'document_expiring',
} as const;
export type RideStatusReasonKind = (typeof RIDE_STATUS_REASON)[keyof typeof RIDE_STATUS_REASON];

export const DUE_STATE = {
  OVERDUE: 'overdue',
  SOON: 'soon',
  LATER: 'later',
  SOMEDAY: 'someday',
} as const;
export type DueState = (typeof DUE_STATE)[keyof typeof DUE_STATE];

export const DUE_TONE = {
  LATE: 'late',
  SOON: 'soon',
  PLAIN: 'plain',
} as const;
export type DueTone = (typeof DUE_TONE)[keyof typeof DUE_TONE];

export const DUE_DIMENSION = {
  TIME: 'time',
  DISTANCE: 'distance',
} as const;
export type DueDimension = (typeof DUE_DIMENSION)[keyof typeof DUE_DIMENSION];

export const DUE_DIRECTION = {
  PAST: 'past',
  AHEAD: 'ahead',
} as const;
export type DueDirection = (typeof DUE_DIRECTION)[keyof typeof DUE_DIRECTION];

/**
 * How a limit is worded. RELATIVE = an amount remaining or elapsed ("In 2 days",
 * "3,933 km to target"); DAY / MONTH = a calendar date at day or month precision
 * ("Jan 10", "Mar 2027"); ABSOLUTE = a target odometer value on a bike whose
 * odometer is unknown ("At 12,000 km").
 */
export const DUE_DISPLAY = {
  RELATIVE: 'relative',
  DAY: 'day',
  MONTH: 'month',
  ABSOLUTE: 'absolute',
} as const;
export type DueDisplay = (typeof DUE_DISPLAY)[keyof typeof DUE_DISPLAY];

export const ATTENTION_KIND = {
  RECALL: 'recall',
  TASK: 'task',
  DOCUMENT: 'document',
} as const;
export type AttentionKind = (typeof ATTENTION_KIND)[keyof typeof ATTENTION_KIND];

export const RECALL_SEVERITY = {
  CRITICAL: 'critical',
  HIGH: 'high',
} as const;
export type RecallSeverity = (typeof RECALL_SEVERITY)[keyof typeof RECALL_SEVERITY];

/** The two distance units a bike can carry (`motorcycles.distance_unit`). */
export const HUB_UNIT = {
  KM: 'km',
  MI: 'mi',
} as const;
export type HubUnit = (typeof HUB_UNIT)[keyof typeof HUB_UNIT];

/** "Due soon" window in days — also the document "expiring" window. */
export const DUE_SOON_DAYS = 30;
/** "Due soon" window in the bike's own unit. Values are never converted. */
export const DUE_SOON_DISTANCE = { km: 2000, mi: 1200 } as const satisfies Record<HubUnit, number>;
/** A due date further away than this is worded at month precision ("Mar 2027"). */
export const DUE_DAY_PRECISION_DAYS = 120;

export const ATTENTION_MAX_ROWS = 3;

/**
 * Seeded document categories whose expiry blocks riding (lead decision D2).
 * Matched only on `kind === SEEDED_CATEGORY_KIND`; replaced in R5 by
 * `document_categories.blocks_riding`.
 */
export const RIDE_BLOCKING_DOCUMENT_CATEGORIES = [
  'Insurance',
  'Inspection',
  'Registration',
] as const;
export const SEEDED_CATEGORY_KIND = 'seeded';

export const ODOMETER_QUICK_ADD = [50, 100, 250] as const;
export const ODOMETER_MAX_DIGITS = 7;
export const ODOMETER_KEY = {
  DELETE: 'delete',
  CLEAR: 'clear',
} as const;
export type OdometerDigit = '0' | '1' | '2' | '3' | '4' | '5' | '6' | '7' | '8' | '9';
export type OdometerKey = OdometerDigit | (typeof ODOMETER_KEY)[keyof typeof ODOMETER_KEY];

export const ODOMETER_ERROR = {
  EMPTY: 'EMPTY',
  FUTURE_DATE: 'FUTURE_DATE',
  UNCHANGED: 'UNCHANGED',
} as const;
export type OdometerError = (typeof ODOMETER_ERROR)[keyof typeof ODOMETER_ERROR];

export const ODOMETER_CONFIRM = {
  LOWER_THAN_LAST: 'LOWER_THAN_LAST',
} as const;
export type OdometerConfirm = (typeof ODOMETER_CONFIRM)[keyof typeof ODOMETER_CONFIRM];

export const DELTA_DIRECTION = {
  UP: 'up',
  DOWN: 'down',
  FLAT: 'flat',
} as const;
export type DeltaDirection = (typeof DELTA_DIRECTION)[keyof typeof DELTA_DIRECTION];

export const UNDO_WINDOW_MS = 5000;

/** A recall is Critical when its text mentions one of these (spec §2), else High. */
export const RECALL_CRITICAL_KEYWORDS = ['stall', 'brake', 'steering', 'fuel', 'fire'] as const;

/** Costs card: categories shown on the bar before the remainder is grouped. */
export const COSTS_TOP_SHARES = 5;
export const COSTS_REST_KEY = 'rest';

/**
 * Screens pushed from the bike hub. `ownerSegmentOf` maps each to the segment
 * the rider should land on when coming back.
 */
export const BIKE_LEAF = {
  ADD_TASK: 'add_task',
  EDIT_TASK: 'edit_task',
  COMPLETE_TASK: 'complete_task',
  ADD_EXPENSE: 'add_expense',
  EXPENSE_DETAIL: 'expense_detail',
  DOCUMENT: 'document',
  ADD_DOCUMENT: 'add_document',
  EDIT_BIKE: 'edit_bike',
  SERVICE_REPORT: 'service_report',
  RECALLS: 'recalls',
  NOTES: 'notes',
  NOTE_SHEET: 'note_sheet',
  LOG_SHEET: 'log_sheet',
  ODOMETER_SHEET: 'odometer_sheet',
} as const;
export type BikeLeaf = (typeof BIKE_LEAF)[keyof typeof BIKE_LEAF];

/** `mode` route param of `add-maintenance-task` that opens it in "log done work" mode. */
export const ADD_TASK_MODE = {
  LOG: 'log',
} as const;

/** Where a note was written — the `source` property of `NOTE_CREATED`. */
export const NOTE_SOURCE = {
  OVERVIEW_QUICK: 'overview_quick',
  SHEET: 'sheet',
  NOTES_COMPOSER: 'notes_composer',
} as const;
export type NoteSource = (typeof NOTE_SOURCE)[keyof typeof NOTE_SOURCE];

/** The `source` property of `ODOMETER_UPDATED`. */
export const ODOMETER_SOURCE = {
  SHEET: 'sheet',
} as const;

/** Notes shown on the Overview before "All notes". */
export const OVERVIEW_NOTES_SHOWN = 2;

/** Options of the Log sheet, in the order they are drawn. */
export const LOG_OPTION = {
  EXPENSE: 'expense',
  TASK: 'task',
  PAST_WORK: 'past_work',
  NOTE: 'note',
  DOCUMENT: 'document',
} as const;
export type LogOption = (typeof LOG_OPTION)[keyof typeof LOG_OPTION];

/**
 * Languages that capitalise nouns: a category name stays as written when it is
 * placed mid-sentence. Every other language lower-cases it.
 */
export const NOUN_CAPITALISING_LANGUAGES = ['de'] as const;

/** Which link a note row offers on the right of its meta line. */
export const NOTE_LINK = {
  TASK: 'task',
  EXPENSE: 'expense',
  MAKE_TASK: 'make_task',
} as const;
export type NoteLinkKind = (typeof NOTE_LINK)[keyof typeof NOTE_LINK];

/** Debounce of the Notes search field. */
export const NOTES_SEARCH_DEBOUNCE_MS = 200;

/**
 * Garage-stack routes that draw the bike hub (and its sheets). The hub is dark
 * in both colour schemes, so the tab bar is pinned dark while one is on top.
 */
export const BIKE_HUB_ROUTES: ReadonlySet<string> = new Set([
  'bike/[id]',
  'notes',
  'note',
  'log-entry',
  'odometer',
]);
