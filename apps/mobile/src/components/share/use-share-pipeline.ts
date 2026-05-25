import { useCallback, useRef, useState } from 'react';
import type { View } from 'react-native';
import { renderShareCard } from './render-share-card';
import type { CardVariant, ShareDestination, ShareResult } from './share-card-types';

interface UseSharePipelineOpts {
  rideId: string;
  updatedAt?: string;
  onHandoff: (destination: ShareDestination, imageUri: string) => Promise<ShareResult>;
}

export function useSharePipeline({ rideId, updatedAt, onHandoff }: UseSharePipelineOpts) {
  const [isBusy, setIsBusy] = useState(false);
  const activeCardRef = useRef<View>(null);

  const handleDestinationTap = useCallback(
    async (destination: ShareDestination, activeVariant: CardVariant) => {
      if (isBusy) return;
      if (!activeCardRef.current) {
        console.warn('[SharePipeline] No active card ref');
        return;
      }

      setIsBusy(true);
      try {
        const imageUri = await renderShareCard(activeCardRef, rideId, activeVariant, updatedAt);
        await onHandoff(destination, imageUri);
      } catch (error) {
        console.warn('[SharePipeline] Error:', error);
      } finally {
        setIsBusy(false);
      }
    },
    [isBusy, rideId, updatedAt, onHandoff],
  );

  return {
    isBusy,
    isIdle: !isBusy,
    activeCardRef,
    handleDestinationTap,
  };
}
