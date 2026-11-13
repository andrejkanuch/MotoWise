jest.mock('../analytics', () => require('../../test/mocks').mockAnalytics());
jest.mock('../onboarding-experiment', () => ({ getOnboardingVariant: () => 'shipped' }));

import { OB_ROUTE } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent } from '../analytics';
import {
  createPostOnboardingLanding,
  LANDING_OVERLAY_NONE,
  postOnboardingLanding,
  trackLandingSheetShown,
} from '../post-onboarding-landing';

const HOME = { name: '/(tabs)/(home)', segments: ['(tabs)', '(home)'] };
const WHATS_NEW = { name: '/(modals)/whats-new', segments: ['(modals)', 'whats-new'] };
const GOALS = { name: '/(onboarding)/goals', segments: ['(onboarding)', 'goals'] };

function setup() {
  let clock = 1_000;
  const track = jest.fn();
  const landing = createPostOnboardingLanding({
    now: () => clock,
    variant: () => 'invested',
    track,
  });
  return {
    landing,
    track,
    advance: (ms: number) => {
      clock += ms;
    },
  };
}

describe('post_onboarding_landed', () => {
  it('fires once, on the first (tabs) screen after onboarding completes on personalizing', () => {
    const { landing, track, advance } = setup();
    landing.noteCompletion(false, OB_ROUTE.PERSONALIZING);
    landing.noteCompletion(true, OB_ROUTE.PERSONALIZING);
    advance(1_250);
    landing.noteScreen(HOME.name, HOME.segments);
    advance(500);
    landing.noteScreen('/(tabs)/(garage)', ['(tabs)', '(garage)']);

    expect(track).toHaveBeenCalledTimes(1);
    expect(track).toHaveBeenCalledWith({
      screen: HOME.name,
      onboarding_variant: 'invested',
      ms_since_cta: 1_250,
      overlay: LANDING_OVERLAY_NONE,
    });
  });

  it('names a non-tab screen shown between completion and the first tab as the overlay', () => {
    const { landing, track } = setup();
    landing.noteCompletion(false, OB_ROUTE.PERSONALIZING);
    landing.noteCompletion(true, OB_ROUTE.PERSONALIZING);
    landing.noteScreen(GOALS.name, GOALS.segments);
    landing.noteScreen(WHATS_NEW.name, WHATS_NEW.segments);
    landing.noteScreen(HOME.name, HOME.segments);

    expect(track).toHaveBeenCalledWith(expect.objectContaining({ overlay: WHATS_NEW.name }));
  });

  it('does not fire for a returning rider whose completion comes from sign-in or launch', () => {
    const { landing, track } = setup();
    landing.noteCompletion(false, null);
    landing.noteCompletion(true, '/(onboarding)/sign-in');
    landing.noteScreen(HOME.name, HOME.segments);
    landing.noteCompletion(false, HOME.name);
    landing.noteCompletion(true, HOME.name);
    landing.noteScreen(HOME.name, HOME.segments);

    expect(track).not.toHaveBeenCalled();
  });

  it('does not fire on a launch that hydrates an already-completed rider', () => {
    const { landing, track } = setup();
    landing.noteCompletion(true, null);
    landing.noteScreen(HOME.name, HOME.segments);
    expect(track).not.toHaveBeenCalled();
  });

  it('the app singleton sends the event through trackEvent with the onboarding variant', () => {
    postOnboardingLanding.noteCompletion(false, OB_ROUTE.PERSONALIZING);
    postOnboardingLanding.noteCompletion(true, OB_ROUTE.PERSONALIZING);
    postOnboardingLanding.noteScreen(HOME.name, HOME.segments);

    expect(trackEvent).toHaveBeenCalledWith(
      AnalyticsEvent.POST_ONBOARDING_LANDED,
      expect.objectContaining({ screen: HOME.name, onboarding_variant: 'shipped' }),
    );
  });
});

describe('landing_sheet_shown', () => {
  it('reports the sheet, its queue position and the time since landing', () => {
    let clock = 0;
    const trackSheet = jest.fn();
    const landing = createPostOnboardingLanding({
      now: () => clock,
      variant: () => 'shipped',
      track: jest.fn(),
      trackSheet,
    });
    // Before any landing this launch (a later-day open): no landing time.
    landing.sheetShown('recall', 0);
    expect(trackSheet).toHaveBeenLastCalledWith({
      sheet: 'recall',
      ms_since_landed: null,
      queue_position: 0,
    });

    landing.noteCompletion(false, OB_ROUTE.PERSONALIZING);
    landing.noteCompletion(true, OB_ROUTE.PERSONALIZING);
    clock = 100;
    landing.noteScreen(HOME.name, HOME.segments);
    clock = 400;
    landing.sheetShown('oem_imported', 1);
    expect(trackSheet).toHaveBeenLastCalledWith({
      sheet: 'oem_imported',
      ms_since_landed: 300,
      queue_position: 1,
    });
  });

  it('the app helper sends landing_sheet_shown', () => {
    trackLandingSheetShown('whats_new', 0);
    expect(trackEvent).toHaveBeenCalledWith(
      AnalyticsEvent.LANDING_SHEET_SHOWN,
      expect.objectContaining({ sheet: 'whats_new', queue_position: 0 }),
    );
  });
});
