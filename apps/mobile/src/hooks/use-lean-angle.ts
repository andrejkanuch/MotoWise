import { DeviceMotion } from 'expo-sensors';
import { useEffect } from 'react';
import { useAnimatedReaction, useDerivedValue, useSharedValue } from 'react-native-reanimated';

const UPDATE_INTERVAL_MS = 33; // ~30Hz to save battery
const ALPHA = 0.15; // low-pass filter coefficient
const MAX_LEAN = 60;
const MIN_LEAN = -60;

export function useLeanAngle() {
  const rawLean = useSharedValue(0);
  const filteredLean = useSharedValue(0);
  const peakLeft = useSharedValue(0);
  const peakRight = useSharedValue(0);

  // Low-pass filter — pure derivation, no side effects
  const smoothLean = useDerivedValue(() => {
    const filtered = filteredLean.value + ALPHA * (rawLean.value - filteredLean.value);
    filteredLean.value = filtered;
    return filtered;
  });

  // Peak tracking as a reaction (proper pattern for side effects)
  useAnimatedReaction(
    () => smoothLean.value,
    (current) => {
      if (current < peakLeft.value) peakLeft.value = current;
      if (current > peakRight.value) peakRight.value = current;
    },
  );

  useEffect(() => {
    let subscription: ReturnType<typeof DeviceMotion.addListener> | null = null;

    try {
      DeviceMotion.setUpdateInterval(UPDATE_INTERVAL_MS);

      subscription = DeviceMotion.addListener((data) => {
        const gamma = data.rotation?.gamma;
        if (gamma == null) return;

        const degrees = gamma * (180 / Math.PI);
        rawLean.value = Math.min(Math.max(degrees, MIN_LEAN), MAX_LEAN);
      });
    } catch {
      // DeviceMotion unavailable (simulator, missing native module) — degrade gracefully
    }

    return () => {
      subscription?.remove();
    };
  }, [rawLean]);

  return { smoothLean, peakLeft, peakRight };
}
