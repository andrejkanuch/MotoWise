import {
  buildActions,
  buildPanelItems,
  deriveSnapshot,
  deriveState,
  type RideInput,
} from '../carplay-templates';

const base: RideInput = {
  status: 'recording',
  recordingSubState: 'moving',
  distance: 42_300,
  elapsedTime: 4360,
  elevationGain: 640,
  gpsLocked: true,
  startMode: 'automatic',
};

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
  });

  it('honors the measurement system for placeholders', () => {
    const snap = deriveSnapshot({ ...base, gpsLocked: false }, 'imperial');
    expect(snap.distance).toContain('mi');
    expect(snap.climb).toContain('ft');
  });
});

describe('buildPanelItems', () => {
  it('fuses state + distance into the title and lists three rows', () => {
    const model = buildPanelItems(deriveSnapshot(base, 'metric'));
    expect(model.title.startsWith('RECORDING · ')).toBe(true);
    expect(model.items.map((i) => i.title)).toEqual(['Moving', 'Climb', 'Mode']);
  });

  it('idle title is the bare READY word (no distance)', () => {
    const model = buildPanelItems(deriveSnapshot({ ...base, status: 'idle' }, 'metric'));
    expect(model.title).toBe('READY');
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
