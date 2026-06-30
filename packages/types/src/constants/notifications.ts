/**
 * Notification `data.kind` discriminator — the single source of truth shared by the
 * mobile notification scheduler/tap-handler and the API push sender (which embeds it
 * in the Expo push payload). Keeping one definition prevents the two sides from
 * silently diverging on the string values.
 */
export const NOTIFICATION_KIND = {
  DOCUMENT: 'document',
  MAINTENANCE: 'maintenance',
  /** MOT-275: day-2 dormant-user re-engagement (local, goal-personalized). */
  RE_ENGAGE: 're_engage',
} as const;

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];
