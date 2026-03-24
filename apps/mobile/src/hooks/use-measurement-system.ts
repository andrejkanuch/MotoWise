import type { MeasurementSystem } from '@motovault/types';
import { useAuthStore } from '../stores/auth.store';

/** Returns the user's measurement system preference ('metric' or 'imperial') */
export function useMeasurementSystem(): MeasurementSystem {
  return useAuthStore((s) => s.measurementSystem);
}
