import {
  buildActions,
  buildPanelItems,
  DUE_SOON_DAYS,
  deriveSnapshot,
  deriveState,
  HEADS_UP_LABEL,
  type HeadsUpTask,
  pickHeadsUp,
  type RideInput,
} from '../carplay-templates';

const base: RideInput = {
  status: 'recording',
  recordingSubState: 'moving',
  distance: 42_300,
  elapsedTime: 4360,
  elevationGain: 640,
  speed: 18, // m/s ≈ 65 km/h
  gpsLocked: true,
  startMode: 'automatic',
  recallCount: 0,
  currentMileage: null,
  tasks: [],
};

// ISO date `days` from now (negative = overdue), for due-date-driven picker tests.
const dayOffset = (days: number): string => {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString();
};

const CLIMB_FALLBACK = '↑640 m';

describe('deriveState', () => {
  it('is acquiring while recording without a GPS lock', () => {
    expect(
      deriveState({ status: 'recording', recordingSubState: 'moving', gpsLocked: false }),
    ).toBe('acquiring');
  });
  it('is recording when moving with a lock', () => {
    expect(deriveState({ status: 'recording', recordingSubState: 'moving', gpsLocked: true })).toBe(
      'recording',
    );
  });
  it('is autoPaused when stopped (auto) or manually paused', () => {
    expect(
      deriveState({ status: 'recording', recordingSubState: 'stopped', gpsLocked: true }),
    ).toBe('autoPaused');
    expect(deriveState({ status: 'paused', recordingSubState: 'moving', gpsLocked: true })).toBe(
      'autoPaused',
    );
  });
  it('keeps a paused ride as autoPaused even before GPS lock (Resume stays available)', () => {
    expect(deriveState({ status: 'paused', recordingSubState: 'moving', gpsLocked: false })).toBe(
      'autoPaused',
    );
    expect(buildActions('autoPaused', 'automatic').map((a) => a.id)).toEqual(['resume', 'stop']);
  });
  it('is idle when not recording', () => {
    expect(deriveState({ status: 'idle', recordingSubState: 'moving', gpsLocked: false })).toBe(
      'idle',
    );
  });
});

describe('deriveSnapshot', () => {
  it('shows dashes (never 0.0) before first GPS lock', () => {
    const snap = deriveSnapshot(
      { ...base, gpsLocked: false, distance: 0, elapsedTime: 0 },
      'metric',
    );
    expect(snap.state).toBe('acquiring');
    expect(snap.distance).toContain('—');
    expect(snap.movingTime).toContain('—');
    expect(snap.climb).toContain('—');
    expect(snap.distance).not.toContain('0');
  });

  it('formats live values once locked', () => {
    const snap = deriveSnapshot(base, 'metric');
    expect(snap.state).toBe('recording');
    expect(snap.distance).toMatch(/km/);
    expect(snap.climb).toMatch(/m/);
    expect(snap.speed).toMatch(/km\/h/);
  });

  it('shows ascent only in the climb row (descent stays in the phone summary)', () => {
    const snap = deriveSnapshot({ ...base, elevationGain: 640 }, 'metric');
    expect(snap.climb).toBe('↑640 m');
    expect(snap.climb).not.toContain('↓');
  });

  it('dashes the speed before GPS lock', () => {
    const snap = deriveSnapshot({ ...base, gpsLocked: false, speed: 0 }, 'metric');
    expect(snap.speed).toContain('—');
    expect(snap.speed).not.toContain('0');
  });

  it('honors the measurement system for placeholders', () => {
    const snap = deriveSnapshot({ ...base, gpsLocked: false }, 'imperial');
    expect(snap.distance).toContain('mi');
    expect(snap.climb).toContain('ft');
  });
});

describe('buildPanelItems', () => {
  it('titles with the state word and leads live rows with speed + distance (≤4 rows)', () => {
    const model = buildPanelItems(deriveSnapshot(base, 'metric'));
    // Title is the state word only — numerics stay in rows so churn can refresh in
    // place (the CarPlay template title is fixed at construction). While riding,
    // speed + distance are the hero values; the row budget is 4.
    //
    // The heads-up row is THIRD, not last. CarPlay pins the action buttons over the
    // final row on at least some head-unit canvas sizes (observed on the simulator
    // 2026-08-25: "Pause" covered the overdue-service text), so the last slot is the
    // one that may be invisible. `Moving` takes that risk because it is also on the
    // phone; an open recall is the only value here a rider cannot see anywhere else.
    expect(model.title).toBe('RECORDING');
    expect(model.items.map((i) => i.title)).toEqual(['Speed', 'Distance', 'Climb', 'Moving']);
    expect(model.items.length).toBeLessThanOrEqual(4);
    expect(model.items[0].detail).toMatch(/km\/h/);
  });

  it('never puts the heads-up row last, where CarPlay action buttons can cover it', () => {
    // Guards the ordering above for every heads-up variant, not just the Climb
    // fallback. If someone reorders the rows and pushes a recall warning into the
    // final slot, this fails — the whole point of the row is that it is readable at
    // a glance, and the last slot is the one that may not be.
    for (const input of [
      base,
      { ...base, recallCount: 1 },
      {
        ...base,
        tasks: [{ title: 'Replace front brake pads', dueDate: dayOffset(-30) } as HeadsUpTask],
      },
    ]) {
      const model = buildPanelItems(deriveSnapshot(input, 'metric'));
      const titles = model.items.map((i) => i.title);
      expect(titles[titles.length - 1]).toBe('Moving');
    }
  });

  it('puts the heads-up recall in row 3 when the active bike has an open recall', () => {
    const model = buildPanelItems(deriveSnapshot({ ...base, recallCount: 1 }, 'metric'));
    expect(model.items.map((i) => i.title)).toEqual(['Speed', 'Distance', 'Recall', 'Moving']);
    // Index 2, not 3 — row 4 is where CarPlay's action buttons land.
    expect(model.items[2].detail).toBe('1 open recall');
    expect(model.items.length).toBe(4); // still within Apple's cap
  });

  it('shows Mode instead of Speed before a ride (idle)', () => {
    const model = buildPanelItems(deriveSnapshot({ ...base, status: 'idle' }, 'metric'));
    expect(model.title).toBe('READY');
    expect(model.items.map((i) => i.title)).toEqual(['Distance', 'Moving', 'Climb', 'Mode']);
  });

  it('shows a stop confirm overlay when armed (Keep Riding leads, then End Ride)', () => {
    const model = buildPanelItems(deriveSnapshot(base, 'metric'), true);
    expect(model.title).toBe('STOP RIDE?');
    // metric rows are unchanged — only the title + actions flip to the confirm
    expect(model.items.map((i) => i.title)).toEqual(['Speed', 'Distance', 'Climb', 'Moving']);
    expect(model.actions.map((a) => a.id)).toEqual(['cancelStop', 'stop']);
  });
});

describe('pickHeadsUp', () => {
  const task = (over: Partial<HeadsUpTask> = {}): HeadsUpTask => ({
    title: 'Oil change',
    status: 'pending',
    dueDate: null,
    targetMileage: null,
    ...over,
  });

  it('recall wins over overdue and due-soon (first rung)', () => {
    const row = pickHeadsUp(
      {
        recallCount: 2,
        currentMileage: 10_000,
        tasks: [task({ dueDate: dayOffset(-10) }), task({ dueDate: dayOffset(2) })],
      },
      CLIMB_FALLBACK,
    );
    expect(row.title).toBe(HEADS_UP_LABEL.recall);
    expect(row.detail).toBe('2 open recalls');
  });

  it('pluralizes the recall count (singular at 1)', () => {
    expect(pickHeadsUp({ recallCount: 1, tasks: [] }, CLIMB_FALLBACK).detail).toBe('1 open recall');
  });

  it('shows the overdue rung for a date-overdue active task', () => {
    const row = pickHeadsUp(
      { recallCount: 0, tasks: [task({ title: 'Chain lube', dueDate: dayOffset(-3) })] },
      CLIMB_FALLBACK,
    );
    expect(row.title).toBe(HEADS_UP_LABEL.overdue);
    expect(row.detail).toBe('Chain lube');
  });

  it('treats a task past its target mileage as overdue (no due date needed)', () => {
    const row = pickHeadsUp(
      {
        recallCount: 0,
        currentMileage: 6_000,
        tasks: [task({ title: 'Valve check', targetMileage: 5_000 })],
      },
      CLIMB_FALLBACK,
    );
    expect(row.title).toBe(HEADS_UP_LABEL.overdue);
    expect(row.detail).toBe('Valve check');
  });

  it('ignores completed/skipped tasks even when past due', () => {
    const row = pickHeadsUp(
      {
        recallCount: 0,
        tasks: [
          task({ title: 'Done', status: 'completed', dueDate: dayOffset(-30) }),
          task({ title: 'Skipped', status: 'skipped', targetMileage: 1 }),
        ],
        currentMileage: 99_999,
      },
      CLIMB_FALLBACK,
    );
    expect(row.detail).toBe(CLIMB_FALLBACK); // falls through to climb
  });

  it('shows the due-soon rung for an active task within the threshold', () => {
    const row = pickHeadsUp(
      { recallCount: 0, tasks: [task({ title: 'Tyre check', dueDate: dayOffset(3) })] },
      CLIMB_FALLBACK,
    );
    expect(row.title).toBe(HEADS_UP_LABEL.service);
    expect(row.detail).toBe('Tyre check · in 3d');
  });

  it('does not flag a task due beyond the threshold as due-soon (falls back to climb)', () => {
    const row = pickHeadsUp(
      { recallCount: 0, tasks: [task({ dueDate: dayOffset(DUE_SOON_DAYS + 30) })] },
      CLIMB_FALLBACK,
    );
    expect(row.title).toBe(HEADS_UP_LABEL.climb);
    expect(row.detail).toBe(CLIMB_FALLBACK);
  });

  it('falls back to the climb ascent string when nothing is pending', () => {
    const row = pickHeadsUp({ recallCount: 0, tasks: [] }, CLIMB_FALLBACK);
    expect(row).toEqual({ title: HEADS_UP_LABEL.climb, detail: CLIMB_FALLBACK });
  });

  it('picks the most-overdue task when several are overdue (tie-break)', () => {
    const row = pickHeadsUp(
      {
        recallCount: 0,
        tasks: [
          task({ title: 'Less overdue', dueDate: dayOffset(-2) }),
          task({ title: 'Most overdue', dueDate: dayOffset(-40) }),
        ],
      },
      CLIMB_FALLBACK,
    );
    expect(row.detail).toBe('Most overdue');
  });
});

describe('buildActions', () => {
  it('recording offers Pause + Stop', () => {
    expect(buildActions('recording', 'automatic').map((a) => a.id)).toEqual(['pause', 'stop']);
  });
  it('autoPaused offers Resume + Stop', () => {
    expect(buildActions('autoPaused', 'automatic').map((a) => a.id)).toEqual(['resume', 'stop']);
  });
  it('idle shows Start only in manual mode (no duplicate-start in auto)', () => {
    expect(buildActions('idle', 'manual').map((a) => a.id)).toEqual(['start']);
    expect(buildActions('idle', 'automatic')).toEqual([]);
  });
});

describe('forgot-to-stop prompt (CarPlay title)', () => {
  const stopped: RideInput = { ...base, recordingSubState: 'stopped', speed: 0 };

  it('replaces the state word so a glance is enough', () => {
    // Without this the title reads AUTO-PAUSED — indistinguishable from a traffic
    // light. The phone notification is easy to miss on a bike, so the panel the
    // rider is already looking at has to carry the prompt.
    const snap = deriveSnapshot({ ...stopped, forgotToStopPending: true }, 'metric');
    expect(snap.forgotToStopPending).toBe(true);
    expect(buildPanelItems(snap).title).toBe('STILL RIDING?');
  });

  it('leaves the normal state word alone when the ride looks healthy', () => {
    expect(buildPanelItems(deriveSnapshot(stopped, 'metric')).title).toBe('AUTO-PAUSED');
    expect(buildPanelItems(deriveSnapshot(base, 'metric')).title).toBe('RECORDING');
  });

  it('never prompts on an idle panel, even if the flag is stale', () => {
    // A leftover flag from a previous ride must not greet the rider with
    // "STILL RIDING?" before they have started one.
    const snap = deriveSnapshot({ ...base, status: 'idle', forgotToStopPending: true }, 'metric');
    expect(snap.forgotToStopPending).toBe(false);
    expect(buildPanelItems(snap).title).toBe('READY');
  });

  it('yields to an armed Stop — a rider action outranks an advisory', () => {
    const snap = deriveSnapshot({ ...stopped, forgotToStopPending: true }, 'metric');
    expect(buildPanelItems(snap, true).title).toBe('STOP RIDE?');
  });

  it('keeps Resume + Stop available so the prompt is actionable', () => {
    const snap = deriveSnapshot({ ...stopped, forgotToStopPending: true }, 'metric');
    expect(buildPanelItems(snap).actions?.map((a) => a.id)).toEqual(['resume', 'stop']);
  });
});
