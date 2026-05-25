/**
 * One-time migration: moves persisted Zustand store data from AsyncStorage to MMKV.
 *
 * AsyncStorage is kept as a dependency for one release cycle so existing users
 * get their data migrated. Remove this file (and the AsyncStorage dependency)
 * once the migration window has passed.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { createMMKV } from 'react-native-mmkv';

const MIGRATION_KEYS = ['auth-preferences', 'whats-new', 'learn-onboarding'] as const;

export async function migrateAsyncStorageToMMKV() {
  for (const key of MIGRATION_KEYS) {
    const mmkv = createMMKV({ id: key });

    // Already migrated — MMKV has data for this store
    if (mmkv.getString(key)) continue;

    try {
      const value = await AsyncStorage.getItem(key);
      if (value) {
        mmkv.set(key, value);
        await AsyncStorage.removeItem(key);
      }
    } catch {
      // Silently ignore — store will reinitialize with defaults
    }
  }
}
