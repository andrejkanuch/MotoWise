import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for Sentry MOTO-VAULT-REACT-NATIVE-16: the Mapbox
// compass->bearing transition crashes with "Cannot round NaN value" on low-end /
// uncalibrated sensors. The ride HUD may now offer heading-up, but it must do so
// with GPS *course* (UserTrackingMode.FollowWithCourse + puckBearing="course")
// and NEVER with the compass heading (FollowWithHeading / puckBearing="heading").
// This mobile codebase has no RN component test renderer wired up, so we lock the
// crash-safe configuration at the source level — a switch to the compass path
// re-introduces the crash and fails here.
const mapSource = readFileSync(join(__dirname, '..', 'hud-map.tsx'), 'utf8');
const followSource = readFileSync(join(__dirname, '..', 'hud-map-follow.ts'), 'utf8');

describe('HudMap tracking mode (Sentry MOTO-VAULT-REACT-NATIVE-16)', () => {
  it('tracks with GPS course, not the compass puck', () => {
    expect(mapSource).toContain('puckBearing="course"');
    expect(mapSource).toContain('compassEnabled={false}');
  });

  it('resolves the follow mode through the NaN-guarded helper', () => {
    // The camera never gets a hard-coded compass mode — it goes through
    // resolveFollowUserMode, which holds north-up until a finite course exists.
    expect(mapSource).toContain('resolveFollowUserMode');
    expect(mapSource).toMatch(/followUserMode=\{followUserMode\}/);
  });

  it('never uses compass-heading tracking (the NaN crash trigger)', () => {
    // Match the usage form (UserTrackingMode.FollowWithHeading), not the bare word,
    // so comments may document *why* the compass path is avoided.
    expect(mapSource).not.toContain('UserTrackingMode.FollowWithHeading');
    expect(mapSource).not.toContain('puckBearing="heading"');
    // The follow helper resolves to Follow / FollowWithCourse but never the compass mode.
    expect(followSource).not.toContain('UserTrackingMode.FollowWithHeading');
  });
});
