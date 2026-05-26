import { palette } from '@motovault/design-system';
import type { LucideIcon } from 'lucide-react-native';
import {
  Bike,
  Gauge,
  LayoutGrid,
  Map as MapIcon,
  MessageCircle,
  Mountain,
  Navigation,
  Paintbrush,
  Route,
  Share2,
  Sparkles,
  TrendingUp,
  Users,
  Wrench,
} from 'lucide-react-native';

export interface WhatsNewSlide {
  icon: LucideIcon;
  iconColor: string;
  titleKey: string;
  descriptionKey: string;
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

/** Find the release entry for a given version, or null if none exists. */
export function getWhatsNewRelease(version: string): WhatsNewReleaseEntry | null {
  return WHATS_NEW_RELEASES.find((r) => r.version === version) ?? null;
}

/** Return the most recent release (first entry in the array). */
export function getLatestRelease(): WhatsNewReleaseEntry {
  return WHATS_NEW_RELEASES[0];
}
