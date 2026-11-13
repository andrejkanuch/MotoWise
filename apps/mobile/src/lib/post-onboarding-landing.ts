import type { JsonType } from '@posthog/core';
import { OB_ROUTE } from '../config/onboarding';
import { AnalyticsEvent, trackEvent } from './analytics';
import { getOnboardingVariant } from './onboarding-experiment';

/**
 * `post_onboarding_landed` (issue 365 T05d, FS-OB6): the first `(tabs)` screen
 * the rider sees after onboarding completes, reported once per launch.
 *
 * Fed by hooks/use-screen-tracking.ts, the app's one screen tracker:
 * - `noteCompletion` with the auth store's `onboardingCompleted` and the screen
 *   on view. Completion counts only when it flips to true while personalizing is
 *   on screen: that is "Open my garage" (after the onboarding paywall closes in
 *   the garage-paywall arm), "Skip and continue", or the silent cold-start
 *   resume. A returning rider whose completion comes from `me` after sign-in, or
 *   a launch that loads an already-completed rider, is not a landing.
 * - `noteScreen` with every screen view. The first `(tabs)` view fires the event.
 *
 * `ms_since_cta` is measured from that completion flip (the rider's release to
 * the garage), so time spent deciding on the paywall is not in it.
 * `overlay` names the first non-tab, non-onboarding screen (a route modal such
 * as What's New) shown between completion and the first tab, else `none`.
 * Sheets drawn inside Home are not routes; T16b reports them with
 * `landing_sheet_shown`, which carries `ms_since_landed` from here.
 */
export const LANDING_OVERLAY_NONE = 'none';

const TABS_GROUP = '(tabs)';
const NOT_AN_OVERLAY: ReadonlySet<string> = new Set(['(onboarding)', '(auth)']);

interface LandingDeps {
  now: () => number;
  variant: () => string;
  track: (properties: Record<string, JsonType>) => void;
  trackSheet?: (properties: Record<string, JsonType>) => void;
}

export function createPostOnboardingLanding({ now, variant, track, trackSheet }: LandingDeps) {
  let completed: boolean | undefined;
  let completedAt: number | null = null;
  let overlay: string | null = null;
  let landedAt: number | null = null;

  return {
    noteCompletion(isCompleted: boolean, currentScreen: string | null) {
      const flippedOn = completed === false && isCompleted;
      completed = isCompleted;
      if (!flippedOn || landedAt !== null || currentScreen !== OB_ROUTE.PERSONALIZING) return;
      completedAt = now();
      overlay = null;
    },

    noteScreen(name: string, segments: readonly string[]) {
      if (completedAt === null) return;
      const group = segments[0] ?? '';
      if (group !== TABS_GROUP) {
        if (overlay === null && !NOT_AN_OVERLAY.has(group)) overlay = name;
        return;
      }
      landedAt = now();
      track({
        screen: name,
        onboarding_variant: variant(),
        ms_since_cta: landedAt - completedAt,
        overlay: overlay ?? LANDING_OVERLAY_NONE,
      });
      completedAt = null;
    },

    /** A sheet shown over Home; `queuePosition` is its place in the landing queue (0 = first). */
    sheetShown(sheet: string, queuePosition: number) {
      trackSheet?.({
        sheet,
        ms_since_landed: landedAt === null ? null : now() - landedAt,
        queue_position: queuePosition,
      });
    },
  };
}

/** The app's one landing tracker (fed by hooks/use-screen-tracking.ts). */
export const postOnboardingLanding = createPostOnboardingLanding({
  now: Date.now,
  variant: getOnboardingVariant,
  track: (properties) => trackEvent(AnalyticsEvent.POST_ONBOARDING_LANDED, properties),
  trackSheet: (properties) => trackEvent(AnalyticsEvent.LANDING_SHEET_SHOWN, properties),
});

/** Reports `landing_sheet_shown` for a sheet over Home (T16b's sheet queue calls this). */
export function trackLandingSheetShown(sheet: string, queuePosition: number): void {
  postOnboardingLanding.sheetShown(sheet, queuePosition);
}
