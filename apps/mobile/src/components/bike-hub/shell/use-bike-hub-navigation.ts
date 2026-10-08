import { type Href, useIsFocused, useRouter } from 'expo-router';
import { useMemo, useRef } from 'react';
import {
  ADD_TASK_MODE,
  BIKE_LEAF,
  type BikeLeaf,
  type BikeSegment,
} from '../../../lib/bike-hub/constants';
import { ownerSegmentOf } from '../../../lib/bike-hub/segments';
import { EXPENSE_ENTRY_SOURCE } from '../../../lib/expense-analytics';
import type { HubBike } from './use-bike-hub-data';

export interface BikeHubNavigation {
  /**
   * Show the leaf's owning segment, then push the leaf — so coming back lands on
   * the segment the leaf belongs to. The remembered segment is not touched: a
   * leaf push is not the rider choosing a segment.
   */
  openLeaf: (leaf: BikeLeaf, href: Href) => void;
  addTask: () => void;
  logPastWork: () => void;
  addExpense: () => void;
  addDocument: () => void;
  openDocument: (documentId: string) => void;
  openNotes: () => void;
  openNoteSheet: (draft?: string) => void;
  openLogSheet: () => void;
  openOdometerSheet: () => void;
}

type Push = (href: Href) => void;

/** Typed routes of every leaf the hub opens, bound to one bike. */
export function buildBikeHubNavigation(
  bike: Pick<HubBike, 'id' | 'year' | 'make' | 'model' | 'nickname'>,
  activeSegment: BikeSegment,
  showSegment: (segment: BikeSegment) => void,
  push: Push,
): BikeHubNavigation {
  const motorcycleId = bike.id;
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;
  const formParams = { motorcycleId, bikeName };

  const openLeaf = (leaf: BikeLeaf, href: Href) => {
    const owner = ownerSegmentOf(leaf);
    if (owner && owner !== activeSegment) showSegment(owner);
    push(href);
  };

  return {
    openLeaf,
    addTask: () =>
      openLeaf(BIKE_LEAF.ADD_TASK, {
        pathname: '/(tabs)/(garage)/add-maintenance-task',
        params: formParams,
      }),
    logPastWork: () =>
      openLeaf(BIKE_LEAF.ADD_TASK, {
        pathname: '/(tabs)/(garage)/add-maintenance-task',
        params: { ...formParams, mode: ADD_TASK_MODE.LOG },
      }),
    addExpense: () =>
      openLeaf(BIKE_LEAF.ADD_EXPENSE, {
        pathname: '/(tabs)/(garage)/add-expense',
        params: { ...formParams, entrySource: EXPENSE_ENTRY_SOURCE.BIKE_HUB },
      }),
    addDocument: () =>
      openLeaf(BIKE_LEAF.ADD_DOCUMENT, {
        pathname: '/(tabs)/(garage)/add-document',
        params: formParams,
      }),
    openDocument: (documentId) =>
      openLeaf(BIKE_LEAF.DOCUMENT, {
        pathname: '/(tabs)/(garage)/document/[id]',
        params: {
          id: documentId,
          motorcycleId,
          bikeName: bike.nickname ?? `${bike.make} ${bike.model}`,
        },
      }),
    openNotes: () =>
      openLeaf(BIKE_LEAF.NOTES, {
        pathname: '/(tabs)/(garage)/notes',
        params: { motorcycleId, from: activeSegment },
      }),
    openNoteSheet: (draft) =>
      openLeaf(BIKE_LEAF.NOTE_SHEET, {
        pathname: '/(tabs)/(garage)/note',
        params: draft ? { motorcycleId, draft } : { motorcycleId },
      }),
    openLogSheet: () =>
      openLeaf(BIKE_LEAF.LOG_SHEET, {
        pathname: '/(tabs)/(garage)/log-entry',
        params: { motorcycleId },
      }),
    openOdometerSheet: () =>
      openLeaf(BIKE_LEAF.ODOMETER_SHEET, {
        pathname: '/(tabs)/(garage)/odometer',
        params: { motorcycleId },
      }),
  };
}

/**
 * Two leaf opens this close together are one double-tap (or a tap landing while
 * the first push is still animating): only the first one navigates.
 */
const LEAF_PUSH_COOLDOWN_MS = 600;

export function useBikeHubNavigation(
  bike: Pick<HubBike, 'id' | 'year' | 'make' | 'model' | 'nickname'>,
  activeSegment: BikeSegment,
  showSegment: (segment: BikeSegment) => void,
): BikeHubNavigation {
  const router = useRouter();
  // Read at press time: the header chip stays mounted (and, mid-transition,
  // tappable) under a screen being pushed; a sheet pushed from a hub that is no
  // longer on top stacked over that screen and could not be dismissed.
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const lastPushAt = useRef(0);
  return useMemo(
    () =>
      buildBikeHubNavigation(bike, activeSegment, showSegment, (href) => {
        const now = Date.now();
        if (!focusedRef.current || now - lastPushAt.current < LEAF_PUSH_COOLDOWN_MS) return;
        lastPushAt.current = now;
        router.push(href);
      }),
    [bike, activeSegment, showSegment, router],
  );
}
