import { initialPhoneSceneVisible } from '../phone-scene';

// Gates the ATT prompt: it must wait for the phone UI on a CarPlay-only launch, but a
// wrong "hidden" here would mean ATT (and the Meta SDK init after it) never runs.
describe('initialPhoneSceneVisible', () => {
  it('is visible without the CarPlay library (Android / no pod) — unchanged behavior', () => {
    expect(
      initialPhoneSceneVisible({
        carPlayAvailable: false,
        appActive: false,
        headUnitConnected: true,
      }),
    ).toBe(true);
  });

  it('is visible for an ordinary phone launch (active, no head unit)', () => {
    expect(
      initialPhoneSceneVisible({
        carPlayAvailable: true,
        appActive: true,
        headUnitConnected: false,
      }),
    ).toBe(true);
  });

  it('starts hidden on a CarPlay-only launch (active only because of the head unit)', () => {
    expect(
      initialPhoneSceneVisible({
        carPlayAvailable: true,
        appActive: true,
        headUnitConnected: true,
      }),
    ).toBe(false);
  });

  it('starts hidden in the background', () => {
    expect(
      initialPhoneSceneVisible({
        carPlayAvailable: true,
        appActive: false,
        headUnitConnected: false,
      }),
    ).toBe(false);
  });
});
