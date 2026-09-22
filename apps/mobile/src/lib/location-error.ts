/**
 * CoreLocation / TaskManager error classification for the background ride
 * location task.
 *
 * `TaskManagerError.code` is typed `string | number` by expo-task-manager, and on
 * iOS it carries the raw kCLErrorDomain code. Only two of them matter to us:
 * 0 is transient and must never be reported (Apple: the manager has not stopped,
 * keep waiting), 1 means the rider revoked location permission and the update
 * stream is dead for good — the ride is silently no longer recording.
 */

export const CORE_LOCATION_ERROR_CODE = {
  /** kCLErrorLocationUnknown — location temporarily unavailable. Transient. */
  LOCATION_UNKNOWN: 0,
  /** kCLErrorDenied — permission revoked / Location Services off. Terminal. */
  DENIED: 1,
  /** kCLErrorNetwork — network unavailable for the location request. */
  NETWORK: 2,
} as const;

export const LOCATION_TASK_ERROR_ACTION = {
  /** Expected and self-healing — drop it, do not create a Sentry issue. */
  IGNORE: 'ignore',
  /** Unknown/unexpected — report it so we find out what it is. */
  REPORT: 'report',
  /** The stream is dead because permission is gone — degrade the ride. */
  PERMISSION_LOST: 'permissionLost',
} as const;

export type LocationTaskErrorAction =
  (typeof LOCATION_TASK_ERROR_ACTION)[keyof typeof LOCATION_TASK_ERROR_ACTION];

/** The one and only place a CoreLocation code maps to what we do about it. */
const LOCATION_TASK_ERROR_ACTIONS: Record<number, LocationTaskErrorAction> = {
  [CORE_LOCATION_ERROR_CODE.LOCATION_UNKNOWN]: LOCATION_TASK_ERROR_ACTION.IGNORE,
  [CORE_LOCATION_ERROR_CODE.DENIED]: LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
};

/**
 * The subset of `TaskManagerError` this module needs — kept local so the
 * classifier stays pure and trivially testable without importing Expo types.
 */
export interface LocationTaskError {
  code: string | number;
  message: string;
}

/**
 * Symbolic `code` values, matched case-insensitively.
 *
 * Expo types `code` as `string | number` and documents NOTHING about its
 * contents — every official example reads only `error.message`. Production
 * (3.19.1+90, iOS) sends a number, but a symbolic string on another platform or
 * build would make `Number()` return NaN and drop every denial into REPORT,
 * reintroducing this very bug. So both forms are matched; a redundant strategy
 * costs nothing, a wrong assumption costs a silent regression.
 */
const SYMBOLIC_LOCATION_ERROR_CODES: Record<string, number> = {
  kclerrordenied: CORE_LOCATION_ERROR_CODE.DENIED,
  e_location_denied: CORE_LOCATION_ERROR_CODE.DENIED,
  e_no_permissions: CORE_LOCATION_ERROR_CODE.DENIED,
  kclerrorlocationunknown: CORE_LOCATION_ERROR_CODE.LOCATION_UNKNOWN,
  e_location_unavailable: CORE_LOCATION_ERROR_CODE.LOCATION_UNKNOWN,
};

/**
 * iOS formats the message as `Error Domain=kCLErrorDomain Code=1 "(null)"`.
 * `message` is the one field Expo's own docs guarantee is populated.
 */
const CORE_LOCATION_MESSAGE_CODE = /Code=(\d+)/;

/**
 * Pure. Resolves the CoreLocation code through three independent strategies —
 * numeric (or numeric-string) `code`, symbolic string `code`, then the `Code=`
 * embedded in `message`. Returns `null` when none of them yields a code.
 *
 * Exported for the capture context and for tests.
 */
export function resolveLocationErrorCode(error: LocationTaskError): number | null {
  const raw = error.code;
  // `Number('')` and `Number(null)` are both 0 — which maps to LOCATION_UNKNOWN
  // and would be SILENTLY IGNORED. Accept a numeric reading only from a real
  // number or a non-blank string.
  if (typeof raw === 'number' && !Number.isNaN(raw)) return raw;
  if (typeof raw === 'string' && raw.trim() !== '') {
    const numeric = Number(raw);
    if (!Number.isNaN(numeric)) return numeric;

    const symbolic = SYMBOLIC_LOCATION_ERROR_CODES[raw.trim().toLowerCase()];
    if (symbolic !== undefined) return symbolic;
  }

  const matched = CORE_LOCATION_MESSAGE_CODE.exec(error.message ?? '');
  return matched ? Number(matched[1]) : null;
}

/**
 * Pure. Unmapped codes and unresolvable values both fall through to REPORT — an
 * unknown failure mode must stay visible, never silently swallowed.
 */
export function classifyLocationTaskError(error: LocationTaskError): LocationTaskErrorAction {
  const code = resolveLocationErrorCode(error);
  if (code === null) return LOCATION_TASK_ERROR_ACTION.REPORT;
  return LOCATION_TASK_ERROR_ACTIONS[code] ?? LOCATION_TASK_ERROR_ACTION.REPORT;
}
