import { useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { queryKeys } from '../lib/query-keys';

/** Read bike name from TanStack Query cache — no network call */
export function useBikeName(motorcycleId: string | null | undefined): string | null {
  const queryClient = useQueryClient();

  return useMemo(() => {
    if (!motorcycleId) return null;
    const cachedData = queryClient.getQueryData<{
      myMotorcycles?: Array<{
        id: string;
        nickname?: string | null;
        make: string;
        model: string;
      }>;
    }>(queryKeys.motorcycles.lists());
    const bike = cachedData?.myMotorcycles?.find((m) => m.id === motorcycleId);
    if (!bike) return null;
    return bike.nickname || `${bike.make} ${bike.model}`;
  }, [motorcycleId, queryClient]);
}
