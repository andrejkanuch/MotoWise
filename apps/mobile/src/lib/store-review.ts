import Constants from 'expo-constants';
import * as StoreReview from 'expo-store-review';
import { createMMKV } from 'react-native-mmkv';

const storage = createMMKV({ id: 'store-review' });

const RIDE_COUNT_KEY = 'review:rideCount';
const TASK_COUNT_KEY = 'review:taskCount';
const REVIEWED_VERSION_KEY = 'review:version';

export function incrementRideCount(): number {
  const count = (storage.getNumber(RIDE_COUNT_KEY) ?? 0) + 1;
  storage.set(RIDE_COUNT_KEY, count);
  return count;
}

export function incrementTaskCount(): number {
  const count = (storage.getNumber(TASK_COUNT_KEY) ?? 0) + 1;
  storage.set(TASK_COUNT_KEY, count);
  return count;
}

export async function maybeRequestReview(): Promise<void> {
  const currentVersion = Constants.expoConfig?.version ?? '1.0.0';
  if (storage.getString(REVIEWED_VERSION_KEY) === currentVersion) return;

  const rides = storage.getNumber(RIDE_COUNT_KEY) ?? 0;
  const tasks = storage.getNumber(TASK_COUNT_KEY) ?? 0;
  if (rides < 3 && tasks < 5) return;

  if (!(await StoreReview.hasAction())) return;

  await StoreReview.requestReview();
  storage.set(REVIEWED_VERSION_KEY, currentVersion);
}
