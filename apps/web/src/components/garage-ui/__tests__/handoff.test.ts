import { encode } from 'uqr';
import { describe, expect, it } from 'vitest';
import {
  APP_BAR_DISMISS_KEY,
  APP_HANDOFF_DISPLAY,
  APP_HANDOFF_URL,
  buildQrPath,
  calmReasonsFor,
  type DismissStorage,
  HandoffReason,
  isAppBarDismissed,
  pickPromotedHandoff,
  rememberAppBarDismissed,
  SignInMethod,
  signInMethodFromProvider,
} from '../handoff';

function memoryStorage(): DismissStorage & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => {
      data.set(key, value);
    },
  };
}

const throwingStorage: DismissStorage = {
  getItem: () => {
    throw new Error('SecurityError: storage blocked');
  },
  setItem: () => {
    throw new Error('QuotaExceededError');
  },
};

describe('handoff URL', () => {
  it('points every action at the production /get page', () => {
    expect(APP_HANDOFF_URL).toBe('https://motovault.app/get');
    expect(APP_HANDOFF_DISPLAY).toBe('motovault.app/get');
  });
});

describe('buildQrPath', () => {
  it('encodes the handoff URL with medium error correction and no border', () => {
    const qr = buildQrPath();
    const reference = encode(APP_HANDOFF_URL, { ecc: 'M', border: 0 });
    expect(qr.size).toBe(reference.size);
  });

  it('draws exactly the dark modules of the matrix', () => {
    const { size, d } = buildQrPath();
    const { data } = encode(APP_HANDOFF_URL, { ecc: 'M', border: 0 });
    const painted = new Set<string>();
    for (const run of d.matchAll(/M(\d+) (\d+)h(\d+)/g)) {
      const [x, y, w] = [Number(run[1]), Number(run[2]), Number(run[3])];
      for (let i = 0; i < w; i++) painted.add(`${x + i},${y}`);
    }
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        expect(painted.has(`${x},${y}`)).toBe(data[y][x]);
      }
    }
  });

  it('starts with the top-left finder pattern (a 7-module dark run)', () => {
    expect(buildQrPath().d.startsWith('M0 0h7v1h-7z')).toBe(true);
  });
});

describe('pickPromotedHandoff', () => {
  const year = 2026;

  it('promotes an overdue service first', () => {
    expect(
      pickPromotedHandoff({
        overdueTaskTitle: 'Brake Pads Inspection',
        hasRides: false,
        hasExpensesThisYear: false,
        year,
      }),
    ).toEqual({ reason: HandoffReason.MarkServiceDone, taskTitle: 'Brake Pads Inspection' });
  });

  it('then no rides, then nothing logged this year', () => {
    expect(pickPromotedHandoff({ hasRides: false, hasExpensesThisYear: false, year })).toEqual({
      reason: HandoffReason.RecordRides,
    });
    expect(pickPromotedHandoff({ hasRides: true, hasExpensesThisYear: false, year })).toEqual({
      reason: HandoffReason.ScanReceipts,
      year,
    });
  });

  it('never promotes on unknown data', () => {
    expect(pickPromotedHandoff({ hasRides: null, hasExpensesThisYear: undefined, year })).toBe(
      null,
    );
  });

  it('ignores a blank task title', () => {
    expect(pickPromotedHandoff({ overdueTaskTitle: '   ', hasRides: true, year })).toBe(null);
  });
});

describe('calmReasonsFor', () => {
  it('lists every calm reason when nothing is promoted', () => {
    expect(calmReasonsFor(null)).toEqual([
      HandoffReason.RecordRides,
      HandoffReason.ServiceReminders,
      HandoffReason.ScanReceipts,
    ]);
  });

  it('does not repeat the promoted reason', () => {
    expect(calmReasonsFor({ reason: HandoffReason.RecordRides })).toEqual([
      HandoffReason.ServiceReminders,
      HandoffReason.ScanReceipts,
    ]);
    expect(
      calmReasonsFor({ reason: HandoffReason.MarkServiceDone, taskTitle: 'Coolant' }),
    ).toHaveLength(3);
  });
});

describe('app bar dismissal', () => {
  it('shows the bar until it is dismissed, then remembers it', () => {
    const storage = memoryStorage();
    expect(isAppBarDismissed(storage)).toBe(false);
    rememberAppBarDismissed(storage);
    expect(storage.data.get(APP_BAR_DISMISS_KEY)).toBe('1');
    expect(isAppBarDismissed(storage)).toBe(true);
  });

  it('shows the bar when storage is missing or throws, and never throws itself', () => {
    expect(isAppBarDismissed(null)).toBe(false);
    expect(isAppBarDismissed(throwingStorage)).toBe(false);
    expect(() => rememberAppBarDismissed(throwingStorage)).not.toThrow();
    expect(() => rememberAppBarDismissed(null)).not.toThrow();
  });

  it('ignores an unexpected stored value', () => {
    const storage = memoryStorage();
    storage.setItem(APP_BAR_DISMISS_KEY, 'true');
    expect(isAppBarDismissed(storage)).toBe(false);
  });
});

describe('signInMethodFromProvider', () => {
  it('maps Supabase providers and falls back to email', () => {
    expect(signInMethodFromProvider('google')).toBe(SignInMethod.Google);
    expect(signInMethodFromProvider('apple')).toBe(SignInMethod.Apple);
    expect(signInMethodFromProvider('email')).toBe(SignInMethod.Email);
    expect(signInMethodFromProvider('github')).toBe(SignInMethod.Email);
    expect(signInMethodFromProvider(undefined)).toBe(SignInMethod.Email);
  });
});
