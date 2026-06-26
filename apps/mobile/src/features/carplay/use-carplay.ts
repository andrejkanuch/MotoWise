// CarPlay companion ↔ app-state seam. The phone screens consume these hooks.
// `useCarPlayConnection` is wired to the native module's connect/disconnect events
// and degrades to "disconnected" when the native module is absent (Android /
// pre-CarPlay build — KTD7). Live ride data and the active bike are real —
// sourced from the ride store and my-motorcycles.

import { MyMotorcyclesDocument, type MyMotorcyclesQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import {
  addConnectListener,
  addDisconnectListener,
  checkForConnection,
  isCarPlayAvailable,
} from '../../../modules/carplay/src';
import type { BannerState } from '../../components/carplay/active-ride-banner';
import { useMeasurementSystem } from '../../hooks/use-measurement-system';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { useCarPlayStore } from '../../stores/carplay.store';
import { useRideStore } from '../../stores/ride.store';
import { formatDistance, formatElapsed, formatElevation } from '../../utils/ride-formatters';

export type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

// CarPlay connection state, wired to the native module. Disconnected (and inert)
// when the module is unavailable.
export function useCarPlayConnection(): { connected: boolean } {
  const [connected, setConnected] = useState(false);

  useEffect(() => {
    if (!isCarPlayAvailable) return;
    const onC = addConnectListener(() => setConnected(true));
    const onD = addDisconnectListener(() => setConnected(false));
    checkForConnection(); // resolve an already-connected head unit
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
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const bikes = data?.myMotorcycles ?? [];
  return bikes.find((b) => b.isPrimary) ?? bikes[0] ?? null;
}

export interface LiveRideSnapshot {
  active: boolean;
  bannerState: BannerState;
  distance: string;
  elapsed: string;
  climb: string;
}

// Live ride projection for the phone banner + status sheet. Real data from the
// ride store; formatted with the user's measurement preference.
export function useLiveRideSnapshot(): LiveRideSnapshot {
  const status = useRideStore((s) => s.status);
  const subState = useRideStore((s) => s.recordingSubState);
  const distance = useRideStore((s) => s.distance);
  const elapsedTime = useRideStore((s) => s.elapsedTime);
  const elevationGain = useRideStore((s) => s.elevationGain);
  const startMode = useCarPlayStore((s) => s.startMode);
  const system = useMeasurementSystem();

  const active = status === 'recording' || status === 'paused';

  let bannerState: BannerState;
  if (status === 'recording') bannerState = subState === 'stopped' ? 'autoPaused' : 'recording';
  else if (status === 'paused') bannerState = 'autoPaused';
  else bannerState = startMode === 'automatic' ? 'armedAuto' : 'manualIdle';

  return {
    active,
    bannerState,
    distance: formatDistance(distance, system),
    elapsed: formatElapsed(elapsedTime),
    climb: formatElevation(elevationGain, system),
  };
}
