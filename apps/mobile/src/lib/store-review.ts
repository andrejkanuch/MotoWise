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

const RIDE_COUNT_KEY = 'review:rideCount';
const TASK_COUNT_KEY = 'review:taskCount';
const REVIEWED_VERSION_KEY = 'review:version';

export function incrementRideCount(): number {
  const storage = getStorage();
  const count = (storage.getNumber(RIDE_COUNT_KEY) ?? 0) + 1;
  storage.set(RIDE_COUNT_KEY, count);
  return count;
}

export function incrementTaskCount(): number {
  const storage = getStorage();
  const count = (storage.getNumber(TASK_COUNT_KEY) ?? 0) + 1;
  storage.set(TASK_COUNT_KEY, count);
  return count;
}

export async function maybeRequestReview(): Promise<void> {
  if (!StoreReview) return;
  const storage = getStorage();
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  if (storage.getString(REVIEWED_VERSION_KEY) === currentVersion) return;

  const rides = storage.getNumber(RIDE_COUNT_KEY) ?? 0;
  const tasks = storage.getNumber(TASK_COUNT_KEY) ?? 0;
  if (rides < 3 && tasks < 5) return;

  if (!(await StoreReview.hasAction())) return;

  await StoreReview.requestReview();
  storage.set(REVIEWED_VERSION_KEY, currentVersion);
}
