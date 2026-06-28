import { readFileSync } from 'node:fs';
import { join } from 'node:path';

// Regression guard for Sentry MOTO-VAULT-REACT-NATIVE-16: the Mapbox
// compass->bearing transition crashes with "Cannot round NaN value" on low-end /
// uncalibrated sensors. The ride HUD must track with GPS course
// (UserTrackingMode.Follow + puckBearing="course") and never with the compass
// heading. This mobile codebase has no RN component test renderer wired up, so we
// lock the exact crash-fix configuration at the source level — a switch back to
// FollowWithCourse / puckBearing="heading" re-introduces the crash and fails here.
const source = readFileSync(join(__dirname, '..', 'hud-map.tsx'), 'utf8');

describe('HudMap tracking mode (Sentry MOTO-VAULT-REACT-NATIVE-16)', () => {
  it('uses GPS course-based follow', () => {
    expect(source).toMatch(/followUserMode=\{UserTrackingMode\.Follow\}/);
    expect(source).toContain('puckBearing="course"');
  });

  it('does not use compass-heading tracking (the NaN crash trigger)', () => {
    expect(source).not.toContain('FollowWithCourse');
    expect(source).not.toContain('puckBearing="heading"');
  });
});
