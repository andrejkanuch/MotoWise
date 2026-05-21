import Constants from 'expo-constants';
import { createMMKV, type MMKV } from 'react-native-mmkv';

let StoreReview: typeof import('expo-store-review') | null = null;
try {
  StoreReview = require('expo-store-review');
} catch {
  // Not available in Expo Go
}

let _storage: MMKV | null = null;
function getStorage(): MMKV {
  if (!_storage) _storage = createMMKV({ id: 'store-review' });
  return _storage;
}

const ACTION_COUNT_KEY = 'review:actionCount';
const REVIEWED_VERSION_KEY = 'review:version';
const THRESHOLD = 5;

export function incrementPositiveAction(): void {
  const storage = getStorage();
  const count = (storage.getNumber(ACTION_COUNT_KEY) ?? 0) + 1;
  storage.set(ACTION_COUNT_KEY, count);
}

export async function maybeRequestReview(): Promise<void> {
  if (!StoreReview) return;
  const storage = getStorage();
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  if (storage.getString(REVIEWED_VERSION_KEY) === currentVersion) return;

  const actions = storage.getNumber(ACTION_COUNT_KEY) ?? 0;
  if (actions < THRESHOLD) return;

  if (!(await StoreReview.isAvailableAsync())) return;
  if (!(await StoreReview.hasAction())) return;

  const { AnalyticsEvent, trackEvent } = require('./analytics');
  trackEvent(AnalyticsEvent.REVIEW_PROMPTED, {
    action_count: actions,
    app_version: currentVersion,
  });

  await StoreReview.requestReview();
  storage.set(REVIEWED_VERSION_KEY, currentVersion);
}
