import { isSameDay } from 'date-fns';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { create } from 'zustand';

interface ClockState {
  today: Date;
  refresh: () => void;
}

/**
 * One "today" for the whole hub. The Date keeps its identity within a calendar
 * day, so memoised derivations stay stable; `refresh` swaps it only when the
 * day has changed.
 */
const useClock = create<ClockState>()((set, get) => ({
  today: new Date(),
  refresh: () => {
    const now = new Date();
    if (!isSameDay(get().today, now)) set({ today: now });
  },
}));

/** Re-reads the clock. Screens call it when they regain focus. */
export function refreshToday(): void {
  useClock.getState().refresh();
}

/**
 * "Today" for the hub's date maths (due lines, ride status, costs, odometer
 * dates). Refreshed on mount and when the app returns to the foreground; the
 * hub screen and the sheets also call `refreshToday` on focus — so a hub left
 * open overnight does not keep yesterday. Tests pass `pinned` to fix the date.
 */
export function useToday(pinned?: Date): Date {
  const today = useClock((state) => state.today);

  useEffect(() => {
    refreshToday();
    const subscription = AppState.addEventListener('change', (status) => {
      if (status === 'active') refreshToday();
    });
    // React Native's jest AppState returns no subscription.
    return () => subscription?.remove();
  }, []);

  return pinned ?? today;
}
