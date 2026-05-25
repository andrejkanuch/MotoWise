import { useCallback, useRef, useState } from 'react';
import { renderShareCard } from './render-share-card';
import type { CardVariant, ShareDestination, ShareResult } from './share-card-types';

export const SHARE_STATE = {
  idle: 'idle',
  capturing: 'capturing',
  handingOff: 'handingOff',
} as const;

export type SharePipelineState = (typeof SHARE_STATE)[keyof typeof SHARE_STATE];

interface UseSharePipelineOpts {
  rideId: string;
  updatedAt?: string;
  onHandoff: (destination: ShareDestination, imageUri: string) => Promise<ShareResult>;
}

export function useSharePipeline({ rideId, updatedAt, onHandoff }: UseSharePipelineOpts) {
  const [state, setState] = useState<SharePipelineState>(SHARE_STATE.idle);
  const cardRefs = useRef<Map<CardVariant, React.RefObject<any>>>(new Map());

  const registerCardRef = useCallback((variant: CardVariant, ref: React.RefObject<any>) => {
    cardRefs.current.set(variant, ref);
  }, []);

  const handleDestinationTap = useCallback(
    async (destination: ShareDestination, activeVariant: CardVariant) => {
      if (state !== SHARE_STATE.idle) return;

      const cardRef = cardRefs.current.get(activeVariant);
      if (!cardRef?.current) {
        console.warn(`[SharePipeline] No ref for variant ${activeVariant}`);
        return;
      }

      setState(SHARE_STATE.capturing);
      try {
        const imageUri = await renderShareCard(cardRef, rideId, activeVariant, updatedAt);
        setState(SHARE_STATE.handingOff);
        await onHandoff(destination, imageUri);
      } catch (error) {
        console.warn('[SharePipeline] Error:', error);
      } finally {
        setState(SHARE_STATE.idle);
      }
    },
    [state, rideId, updatedAt, onHandoff],
  );

  return {
    state,
    isIdle: state === SHARE_STATE.idle,
    isCapturing: state === SHARE_STATE.capturing,
    isHandingOff: state === SHARE_STATE.handingOff,
    registerCardRef,
    handleDestinationTap,
  };
}
