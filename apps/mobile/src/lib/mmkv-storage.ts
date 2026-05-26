import { createMMKV } from 'react-native-mmkv';

/**
 * Creates a Zustand-compatible storage adapter backed by MMKV.
 * Use with `persist(…, { storage: createJSONStorage(() => createZustandMMKVStorage('my-store')) })`.
 */
export function createZustandMMKVStorage(id: string) {
  const mmkv = createMMKV({ id });
  return {
    getItem: (key: string) => mmkv.getString(key) ?? null,
    setItem: (key: string, value: string) => mmkv.set(key, value),
    removeItem: (key: string) => mmkv.remove(key),
  };
}
