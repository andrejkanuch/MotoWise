import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { useRideStore } from '../../stores/ride.store';
import { elapsedRideSeconds } from './ride-controller';

const TICK_MS = 1000;
const APP_STATE_ACTIVE = 'active';

/**
 * The open ride's elapsed riding seconds, for any screen that shows the clock
 * (HUD, tab ride button, CarPlay banner). Derived from the persisted timestamps,
 * so every surface agrees and none depends on another being mounted; it ticks
 * once a second while recording, holds still while paused, and is 0 with no open
 * ride. Skips ticks in the background and catches up on return.
 */
export function useRideElapsed(): number {
  const status = useRideStore((s) => s.status);
  const open = status === 'recording' || status === 'paused';
  const ticking = status === 'recording';
  const [elapsed, setElapsed] = useState(() => (open ? elapsedRideSeconds() : 0));

  useEffect(() => {
    if (!open) {
      setElapsed(0);
      return;
    }
    const tick = () => setElapsed(elapsedRideSeconds());
    tick();
    if (!ticking) return;
    const interval = setInterval(() => {
      if (AppState.currentState === APP_STATE_ACTIVE) tick();
    }, TICK_MS);
    const sub = AppState.addEventListener('change', (state) => {
      if (state === APP_STATE_ACTIVE) tick();
    });
    return () => {
      clearInterval(interval);
      sub.remove();
    };
  }, [open, ticking]);

  return elapsed;
}
