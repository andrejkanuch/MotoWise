import { palette } from '@motovault/design-system';
import type { LucideIcon } from 'lucide-react-native';
import {
  BellRing,
  Bike,
  Car,
  FileText,
  Gauge,
  LayoutGrid,
  Map as MapIcon,
  MessageCircle,
  Mountain,
  Navigation,
  Paintbrush,
  Route,
  ScanLine,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react-native';

/**
 * Optional fast-action a slide's primary CTA can perform instead of just
 * dismissing — deep-links the rider straight into the new feature.
 */
export type WhatsNewAction = 'open-document-vault';

/** Platforms a slide can be restricted to. Matches `process.env.EXPO_OS`. */
export const SLIDE_PLATFORM = {
  IOS: 'ios',
  ANDROID: 'android',
} as const;

export type SlidePlatform = (typeof SLIDE_PLATFORM)[keyof typeof SLIDE_PLATFORM];

export interface WhatsNewSlide {
  icon: LucideIcon;
  iconColor: string;
  titleKey: string;
  descriptionKey: string;
  /** When set, this slide's primary button performs the action + marks the release seen. */
  ctaAction?: WhatsNewAction;
  /** i18n key for the action button label (falls back to the standard CTA copy). */
  ctaLabelKey?: string;
  /**
   * Restricts the slide to specific platforms. Omit for a feature that shipped
   * everywhere — that is the common case and stays zero-config.
   *
   * Needed because not every feature is cross-platform: CarPlay is iOS-only
   * (`@iternio/react-native-auto-play` is excluded from Android autolinking in
   * `package.json`, and the driving-task entitlement is an iOS one), so
   * announcing it to Android riders would advertise something they cannot use.
   */
  platforms?: readonly SlidePlatform[];
}

export interface WhatsNewRelease {
  version: string;
  slides: WhatsNewSlide[];
}

/**
 * Add a new entry at the TOP of this array for each release that has
 * user-facing features worth highlighting. Only the entry matching
 * the current app version is shown.
 */
export const WHATS_NEW_RELEASES = [
  {
    // Both features shipped earlier without ever being announced in-app — this
    // array had no entry between 3.11.0 and here, so the modal stayed dormant
    // for eight releases and riders were never told either existed.
    version: '3.19.1',
    slides: [
      {
        icon: ScanLine,
        iconColor: palette.signature400,
        titleKey: 'whatsNew.v3191.receiptTitle' as const,
        descriptionKey: 'whatsNew.v3191.receiptDesc' as const,
      },
      {
        icon: Car,
        iconColor: palette.accent400,
        titleKey: 'whatsNew.v3191.carplayTitle' as const,
        descriptionKey: 'whatsNew.v3191.carplayDesc' as const,
        // iOS only — see `platforms` on WhatsNewSlide.
        platforms: [SLIDE_PLATFORM.IOS] as const,
      },
    ],
  },
  {
    version: '3.11.0',
    slides: [
      {
        icon: FileText,
        iconColor: palette.signature400,
        titleKey: 'whatsNew.v3110.vaultTitle' as const,
        descriptionKey: 'whatsNew.v3110.vaultDesc' as const,
      },
      {
        icon: BellRing,
        iconColor: palette.warning500,
        titleKey: 'whatsNew.v3110.remindersTitle' as const,
        descriptionKey: 'whatsNew.v3110.remindersDesc' as const,
        ctaAction: 'open-document-vault' as const,
        ctaLabelKey: 'whatsNew.v3110.cta' as const,
      },
    ],
  },
  {
    version: '3.8.0',
    slides: [
      {
        icon: TrendingUp,
        iconColor: palette.accent400,
        titleKey: 'whatsNew.v380.analyticsTitle' as const,
        descriptionKey: 'whatsNew.v380.analyticsDesc' as const,
      },
      {
        icon: Paintbrush,
        iconColor: palette.signature400,
        titleKey: 'whatsNew.v380.redesignedRidesTitle' as const,
        descriptionKey: 'whatsNew.v380.redesignedRidesDesc' as const,
      },
      {
        icon: Mountain,
        iconColor: palette.editorialDarkWarm,
        titleKey: 'whatsNew.v380.flyoverTitle' as const,
        descriptionKey: 'whatsNew.v380.flyoverDesc' as const,
      },
      {
        icon: Share2,
        iconColor: palette.primary400,
        titleKey: 'whatsNew.v380.shareTitle' as const,
        descriptionKey: 'whatsNew.v380.shareDesc' as const,
      },
      {
        icon: LayoutGrid,
        iconColor: palette.signature500,
        titleKey: 'whatsNew.v380.widgetsTitle' as const,
        descriptionKey: 'whatsNew.v380.widgetsDesc' as const,
      },
    ],
  },
  {
    version: '3.7.0',
    slides: [
      {
        icon: Sparkles,
        iconColor: palette.editorialDarkWarm,
        titleKey: 'whatsNew.v360.onboardingTitle' as const,
        descriptionKey: 'whatsNew.v360.onboardingDesc' as const,
      },
      {
        icon: Wrench,
        iconColor: palette.accent400,
        titleKey: 'whatsNew.v360.maintenanceTitle' as const,
        descriptionKey: 'whatsNew.v360.maintenanceDesc' as const,
      },
      {
        icon: Bike,
        iconColor: palette.signature400,
        titleKey: 'whatsNew.v360.bikeSetupTitle' as const,
        descriptionKey: 'whatsNew.v360.bikeSetupDesc' as const,
      },
    ],
  },
  {
    version: '3.0.0',
    slides: [
      {
        icon: Paintbrush,
        iconColor: palette.editorialDarkWarm,
        titleKey: 'whatsNew.v300.redesignTitle' as const,
        descriptionKey: 'whatsNew.v300.redesignDesc' as const,
      },
      {
        icon: Navigation,
        iconColor: palette.accent400,
        titleKey: 'whatsNew.v300.rideRecordingTitle' as const,
        descriptionKey: 'whatsNew.v300.rideRecordingDesc' as const,
      },
      {
        icon: Gauge,
        iconColor: palette.signature400,
        titleKey: 'whatsNew.v300.liveStatsTitle' as const,
        descriptionKey: 'whatsNew.v300.liveStatsDesc' as const,
      },
      {
        icon: MapIcon,
        iconColor: palette.editorialInfo,
        titleKey: 'whatsNew.v300.tripPlannerTitle' as const,
        descriptionKey: 'whatsNew.v300.tripPlannerDesc' as const,
      },
    ],
  },
  {
    version: '2.5.0',
    slides: [
      {
        icon: Users,
        iconColor: palette.primary400,
        titleKey: 'whatsNew.v250.groupRidesTitle' as const,
        descriptionKey: 'whatsNew.v250.groupRidesDesc' as const,
      },
      {
        icon: Route,
        iconColor: palette.accent400,
        titleKey: 'whatsNew.v250.routeReviewsTitle' as const,
        descriptionKey: 'whatsNew.v250.routeReviewsDesc' as const,
      },
      {
        icon: MessageCircle,
        iconColor: palette.signature400,
        titleKey: 'whatsNew.v250.commentsTitle' as const,
        descriptionKey: 'whatsNew.v250.commentsDesc' as const,
      },
      {
        icon: MapIcon,
        iconColor: palette.indigo400,
        titleKey: 'whatsNew.v250.tripsTitle' as const,
        descriptionKey: 'whatsNew.v250.tripsDesc' as const,
      },
    ],
  },
] satisfies WhatsNewRelease[];

export type WhatsNewReleaseEntry = (typeof WHATS_NEW_RELEASES)[number];
export type WhatsNewSlideEntry = WhatsNewReleaseEntry['slides'][number];

/** Slides from `release` that apply to `os`. A slide with no `platforms` is universal. */
export function visibleSlides(
  release: WhatsNewRelease,
  os: string | undefined = process.env.EXPO_OS,
): WhatsNewSlide[] {
  return release.slides.filter((s) => !s.platforms || s.platforms.some((p) => p === os));
}

/**
 * Find the release entry for a given version, or null if none exists.
 *
 * Also returns null when every slide in that release is gated to another
 * platform — the caller uses this to decide whether to open the modal at all,
 * and a release whose only slides are hidden must not push an empty one.
 */
export function getWhatsNewRelease(
  version: string,
  os: string | undefined = process.env.EXPO_OS,
): WhatsNewReleaseEntry | null {
  const release = WHATS_NEW_RELEASES.find((r) => r.version === version);
  if (!release) return null;
  return visibleSlides(release, os).length > 0 ? release : null;
}

/**
 * Return the most recent release that has at least one slide for this platform.
 * Skipping empty ones keeps `slides[0]` defined in the modal.
 */
export function getLatestRelease(
  os: string | undefined = process.env.EXPO_OS,
): WhatsNewReleaseEntry {
  return WHATS_NEW_RELEASES.find((r) => visibleSlides(r, os).length > 0) ?? WHATS_NEW_RELEASES[0];
}
