import {
  CORE_LOCATION_ERROR_CODE,
  classifyLocationTaskError,
  LOCATION_TASK_ERROR_ACTION,
  type LocationTaskError,
  type LocationTaskErrorAction,
  resolveLocationErrorCode,
} from '../location-error';

/** iOS's real wording, as captured in MOTO-VAULT-REACT-NATIVE-2Z. */
const deniedMessage = 'Error Domain=kCLErrorDomain Code=1 "(null)"';

describe('classifyLocationTaskError', () => {
  const cases: [string, LocationTaskError, LocationTaskErrorAction][] = [
    [
      'kCLErrorLocationUnknown is transient — never reported',
      { code: CORE_LOCATION_ERROR_CODE.LOCATION_UNKNOWN, message: 'unknown' },
      LOCATION_TASK_ERROR_ACTION.IGNORE,
    ],
    [
      'kCLErrorDenied degrades the ride',
      { code: CORE_LOCATION_ERROR_CODE.DENIED, message: deniedMessage },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
    [
      'kCLErrorNetwork is unmapped and stays visible',
      { code: CORE_LOCATION_ERROR_CODE.NETWORK, message: 'network' },
      LOCATION_TASK_ERROR_ACTION.REPORT,
    ],
    [
      'an unknown numeric code stays visible',
      { code: 99, message: 'what' },
      LOCATION_TASK_ERROR_ACTION.REPORT,
    ],
    [
      'a numeric string coerces (Expo types code as string | number)',
      { code: '1', message: deniedMessage },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
    [
      'the symbolic iOS name is matched',
      { code: 'kCLErrorDenied', message: 'denied' },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
    [
      'the symbolic Expo name is matched',
      { code: 'E_LOCATION_DENIED', message: 'denied' },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
    [
      'symbolic matching is case-insensitive',
      { code: 'KCLERRORDENIED', message: 'denied' },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
    [
      'an unmapped code falls back to the Code= in the message',
      { code: 'E_UNKNOWN', message: deniedMessage },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
    [
      'an unparseable code and message stays visible',
      { code: 'E_UNKNOWN', message: 'something else' },
      LOCATION_TASK_ERROR_ACTION.REPORT,
    ],
    // REGRESSION GUARD: `Number('')` and `Number(null)` are both 0, which maps to
    // LOCATION_UNKNOWN → IGNORE. A blank code must never be silently swallowed.
    [
      'a blank code is REPORTed, not IGNOREd',
      { code: '', message: 'something else' },
      LOCATION_TASK_ERROR_ACTION.REPORT,
    ],
    [
      'a whitespace-only code is REPORTed, not IGNOREd',
      { code: '   ', message: 'something else' },
      LOCATION_TASK_ERROR_ACTION.REPORT,
    ],
    [
      'a null code is REPORTed, not IGNOREd',
      { code: null as unknown as string, message: 'something else' },
      LOCATION_TASK_ERROR_ACTION.REPORT,
    ],
    [
      'a blank code still honours the message fallback',
      { code: '', message: deniedMessage },
      LOCATION_TASK_ERROR_ACTION.PERMISSION_LOST,
    ],
  ];

  it.each(cases)('%s', (_label, error, expected) => {
    expect(classifyLocationTaskError(error)).toBe(expected);
  });
});

describe('resolveLocationErrorCode', () => {
  it('returns null when no strategy yields a code', () => {
    expect(resolveLocationErrorCode({ code: 'x', message: '' })).toBeNull();
  });

  it('reads the numeric code directly', () => {
    expect(resolveLocationErrorCode({ code: 1, message: '' })).toBe(
      CORE_LOCATION_ERROR_CODE.DENIED,
    );
  });

  it('extracts the code embedded in the iOS message', () => {
    expect(resolveLocationErrorCode({ code: 'E_UNKNOWN', message: deniedMessage })).toBe(
      CORE_LOCATION_ERROR_CODE.DENIED,
    );
  });

  it('tolerates a missing message', () => {
    expect(
      resolveLocationErrorCode({ code: 'x', message: undefined as unknown as string }),
    ).toBeNull();
  });
});
