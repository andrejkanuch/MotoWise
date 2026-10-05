import { createMMKV, type MMKV } from 'react-native-mmkv';
import { useAuthStore } from '../stores/auth.store';
import { AnalyticsEvent, isAnalyticsEnabled, setUserProperties, trackEvent } from './analytics';

/**
 * Core-action counters for PostHog survey targeting.
 *
 * The app does not decide when to show a survey — PostHog does (surveys are
 * rendered by PostHogSurveyProvider and targeted in the dashboard). This module
 * only emits what targeting needs:
 *
 *  - person properties `rides_saved_count` / `services_logged_count`, updated on
 *    every save, for "count ≥ N" person-property targeting; and
 *  - one `core_action_milestone { kind, count }` event per kind when the count
 *    reaches CORE_ACTION_MILESTONE_COUNT, for event-triggered display.
 *
 * Counts are kept on this device per signed-in user and start at 0 on 3.21.0:
 * they mean "saved on this install since this version", not lifetime totals. A
 * rider with an old history therefore reaches the milestone after three more
 * saves, which is acceptable for a survey trigger and keeps this off the network.
 */

export const CORE_ACTION_KIND = {
  RIDE_SAVED: 'ride_saved',
  SERVICE_LOGGED: 'service_logged',
} as const;

export type CoreActionKind = (typeof CORE_ACTION_KIND)[keyof typeof CORE_ACTION_KIND];

export const CORE_ACTION_MILESTONE_COUNT = 3;

const COUNT_PERSON_PROPERTY: Record<CoreActionKind, string> = {
  [CORE_ACTION_KIND.RIDE_SAVED]: 'rides_saved_count',
  [CORE_ACTION_KIND.SERVICE_LOGGED]: 'services_logged_count',
};

const STORAGE_ID = 'core-action-milestones';
const ANONYMOUS_OWNER = 'anonymous';

let storage: MMKV | null = null;
function getStorage(): MMKV {
  if (!storage) storage = createMMKV({ id: STORAGE_ID });
  return storage;
}

function countKey(kind: CoreActionKind): string {
  const owner = useAuthStore.getState().session?.user?.id ?? ANONYMOUS_OWNER;
  return `${owner}:${kind}`;
}

/** Set once the milestone event has actually been sent for this key. */
function sentKey(key: string): string {
  return `${key}:milestone_sent`;
}

/**
 * Record one completed core action and return the new count. Fires the
 * milestone event once per kind per user per install, the first time the count
 * is at or past the milestone WHILE analytics is on — a rider who reaches it
 * with analytics off (or before answering the consent screen) gets it on their
 * next save after opting in, instead of losing it.
 */
export function recordCoreAction(kind: CoreActionKind): number {
  const key = countKey(kind);
  const store = getStorage();
  const count = (store.getNumber(key) ?? 0) + 1;
  store.set(key, count);

  setUserProperties({ [COUNT_PERSON_PROPERTY[kind]]: count });
  const sent = store.getBoolean(sentKey(key)) ?? false;
  if (count >= CORE_ACTION_MILESTONE_COUNT && !sent && isAnalyticsEnabled()) {
    trackEvent(AnalyticsEvent.CORE_ACTION_MILESTONE, { kind, count });
    store.set(sentKey(key), true);
  }
  return count;
}
