import { palette } from '@motovault/design-system';
import type { LucideIcon } from 'lucide-react-native';
import { Map as MapIcon, MessageCircle, Route, Users } from 'lucide-react-native';

export interface WhatsNewSlide {
  icon: LucideIcon;
  iconColor: string;
  iconBgColor: string;
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
    version: '2.5.0',
    slides: [
      {
        icon: Users,
        iconColor: palette.primary400,
        iconBgColor: palette.primary50,
        titleKey: 'whatsNew.v250.groupRidesTitle' as const,
        descriptionKey: 'whatsNew.v250.groupRidesDesc' as const,
      },
      {
        icon: Route,
        iconColor: palette.accent500,
        iconBgColor: palette.successBgLight,
        titleKey: 'whatsNew.v250.routeReviewsTitle' as const,
        descriptionKey: 'whatsNew.v250.routeReviewsDesc' as const,
      },
      {
        icon: MessageCircle,
        iconColor: palette.signature500,
        iconBgColor: palette.signatureBgLight,
        titleKey: 'whatsNew.v250.commentsTitle' as const,
        descriptionKey: 'whatsNew.v250.commentsDesc' as const,
      },
      {
        icon: MapIcon,
        iconColor: palette.indigo500,
        iconBgColor: palette.indigoBg,
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
