// CarPlay companion ↔ app-state seam. The phone screens consume these hooks.
// `useCarPlayConnection` is wired to the native module's connect/disconnect events
// and degrades to "disconnected" when the native module is absent (Android /
// pre-CarPlay build — KTD7). Live ride data and the active bike are real —
// sourced from the ride store and my-motorcycles.

import type { MyMotorcyclesQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useMemo, useState } from 'react';
import { AppState } from 'react-native';
import {
  addConnectListener,
  addDisconnectListener,
  addPhoneSceneVisibilityListener,
  isCarPlayAvailable,
  isHeadUnitConnected,
} from '../../../modules/carplay/src';
import type { BannerState } from '../../components/carplay/active-ride-banner';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { motorcyclesOptions } from '../../lib/query-options';
import { useCarPlayStore } from '../../stores/carplay.store';
import { useRideStore } from '../../stores/ride.store';
import { selectPrimaryBike } from '../../utils/primary-bike';
import { formatDistance, formatElapsed, formatElevation } from '../../utils/ride-formatters';
import { readEndedRideSummary } from '../ride/ride-controller';
import { useRideElapsed } from '../ride/use-ride-elapsed';
import { initialPhoneSceneVisible } from './phone-scene';

export type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

/** Whether the phone UI (not just the CarPlay screen) is on screen. */
export function usePhoneSceneVisible(): boolean {
  const [visible, setVisible] = useState(() =>
    initialPhoneSceneVisible({
      carPlayAvailable: isCarPlayAvailable,
      appActive: AppState.currentState === 'active',
      headUnitConnected: isHeadUnitConnected(),
    }),
  );
  useEffect(() => {
    const sub = addPhoneSceneVisibilityListener(setVisible);
    return () => sub?.remove();
  }, []);
  return visible;
}

// CarPlay connection state, wired to the native module. Disconnected (and inert)
// when the module is unavailable.
export function useCarPlayConnection(): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isCarPlayAvailable) return;
    const onC = addConnectListener(() => setConnected(true));
    const onD = addDisconnectListener(() => setConnected(false));
    setConnected(isHeadUnitConnected()); // resolve an already-connected head unit
    return () => {
      onC?.remove();
      onD?.remove();
    };
  }, []);

  return { connected };
}

// The active (primary) bike, or null while loading / none set.
export function useActiveBike(): Motorcycle | null {
  const { data } = useQuery({
    ...motorcyclesOptions(),
  });
  const bikes = data?.myMotorcycles ?? [];
  return selectPrimaryBike(bikes) ?? null;
}

export interface LiveRideSnapshot {
  /** A ride to show: recording, paused, or ended and waiting for its review. */
  active: boolean;
  bannerState: BannerState;
  distance: string;
  elapsed: string;
  climb: string;
}

type RideStatus = ReturnType<typeof useRideStore.getState>['status'];

// Banner state per ride status. A recording ride splits on the GPS sub-state:
// AUTO-PAUSED is the GPS seeing a stop, PAUSED is the rider's own pause.
const BANNER_STATE: Record<
  RideStatus,
  (ctx: { stopped: boolean; automatic: boolean }) => BannerState
> = {
  recording: ({ stopped }) => (stopped ? 'autoPaused' : 'recording'),
  paused: () => 'paused',
  ended: () => 'saved',
  idle: ({ automatic }) => (automatic ? 'armedAuto' : 'manualIdle'),
};

// Live ride projection for the phone banner + status sheet. Real data from the
// ride store (an ended ride: its stored summary); formatted with the user's
// measurement preference.
export function useLiveRideSnapshot(): LiveRideSnapshot {
  const status = useRideStore((s) => s.status);
  const subState = useRideStore((s) => s.recordingSubState);
  const distance = useRideStore((s) => s.distance);
  const elapsedTime = useRideElapsed();
  const elevationGain = useRideStore((s) => s.elevationGain);
  const startMode = useCarPlayStore((s) => s.startMode);
  const system = useMeasurementSystem();
  const ended = useMemo(() => (status === 'ended' ? readEndedRideSummary() : null), [status]);

  return {
    active: status !== 'idle',
    bannerState: BANNER_STATE[status]({
      stopped: subState === 'stopped',
      automatic: startMode === 'automatic',
    }),
    distance: formatDistance(ended?.distanceM ?? distance, system),
    elapsed: formatElapsed(ended?.movingTimeS ?? elapsedTime),
    climb: formatElevation(ended?.elevationGain ?? elevationGain, system),
  };
}
