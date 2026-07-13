/**
 * Notification `data.kind` discriminator embedded in the Expo push payload by the API
 * push sender. Intended as the shared source of truth for both the API and the mobile
 * scheduler/tap-handler; mobile still carries its own local copy (apps/mobile/src/lib/
 * notifications.ts) and should be migrated to import from here so the two can't diverge.
 */
export const NOTIFICATION_KIND = {
  DOCUMENT: 'document',
  MAINTENANCE: 'maintenance',
  /** MOT-275: day-2 dormant-user re-engagement (local, goal-personalized). */
  RE_ENGAGE: 're_engage',
} as const;

export type NotificationKind = (typeof NOTIFICATION_KIND)[keyof typeof NOTIFICATION_KIND];
