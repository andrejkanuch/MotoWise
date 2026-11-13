import { useQuery } from '@tanstack/react-query';
import { type Href, useIsFocused, useRouter } from 'expo-router';
import { useEffect, useReducer, useRef, useSyncExternalStore } from 'react';
import { MODAL_ROUTE } from '@/config/routes';
import { isConsentPromptOwed } from '@/lib/analytics-consent';
import { LANDING_SHEET, type LandingSheet, landingSheetQueue } from '@/lib/landing-sheet-queue';
import { maintenanceBadgeOptions, motorcyclesOptions } from '@/lib/query-options';
import { isPaywallInFlight, paywallFlightSettled } from '@/lib/subscription';
import { useRideStore } from '@/stores/ride.store';
import { selectPrimaryBike } from '@/utils/primary-bike';
import { RIDE_PHASE } from '@/utils/ride-storage';
import { decideLandingSheets, type LandingBike } from './landing-sheet-owners';

/** Home settles (and the tab bar animates in) before a sheet slides over it. */
export const LANDING_SHEET_DELAY_MS = 1200;

const ACTIVE_RIDE: ReadonlySet<string> = new Set([RIDE_PHASE.RECORDING, RIDE_PHASE.PAUSED]);

function sheetHref(sheet: LandingSheet, bike: LandingBike): Href | null {
  const bikeName = `${bike.year} ${bike.make} ${bike.model}`;
  if (sheet === LANDING_SHEET.RECALL) {
    return { pathname: MODAL_ROUTE.RECALLS, params: { motorcycleId: bike.id, bikeName } };
  }
  if (sheet === LANDING_SHEET.SERVICE_PLAN_READY) {
    return {
      pathname: MODAL_ROUTE.SERVICE_PLAN_READY,
      params: { motorcycleId: bike.id, bikeName },
    };
  }
  return null;
}

/**
 * Home's owners of the two landing sheets (issue 365 T16b, D11): the safety
 * recall for the rider's bike, then "Service plan ready". Both are owed only to
 * a rider who landed from onboarding on this install, and both go through the
 * landing-sheet queue, which allows one modal sheet per cold session. A sheet
 * opens only while Home is focused and nothing else is in the way (consent
 * prompt, a paywall, a ride).
 */
export function useLandingSheets(): void {
  const router = useRouter();
  const isFocused = useIsFocused();
  const rideStatus = useRideStore((s) => s.status);
  const queueVersion = useSyncExternalStore(
    landingSheetQueue.subscribe,
    landingSheetQueue.getVersion,
  );
  const [recheck, requestRecheck] = useReducer((count: number) => count + 1, 0);
  const bikesQuery = useQuery({ ...motorcyclesOptions(), meta: { showErrorAlert: false } });
  const tasksQuery = useQuery(maintenanceBadgeOptions());

  const calm = isFocused && !ACTIVE_RIDE.has(rideStatus);
  const calmRef = useRef(calm);
  calmRef.current = calm;

  const bikes = bikesQuery.data?.myMotorcycles;
  const bikesFailed = bikesQuery.isError && !bikes;
  const tasks = tasksQuery.data?.allMaintenanceTasks;
  const tasksFailed = tasksQuery.isError && !tasks;

  // biome-ignore lint/correctness/useExhaustiveDependencies: queueVersion and recheck re-run the decision when the queue or a paywall changes.
  useEffect(() => {
    const queue = landingSheetQueue;
    if (!queue.isOwed(LANDING_SHEET.RECALL) && !queue.isOwed(LANDING_SHEET.SERVICE_PLAN_READY)) {
      return;
    }
    if (bikesFailed) {
      queue.decline(LANDING_SHEET.RECALL);
      queue.decline(LANDING_SHEET.SERVICE_PLAN_READY);
      return;
    }
    if (!bikes) return;

    const bike = selectPrimaryBike(bikes) ?? null;
    const decision = decideLandingSheets({ bike, tasks, tasksFailed, isOwed: queue.isOwed });
    for (const sheet of decision.drop) queue.drop(sheet);
    for (const sheet of decision.decline) queue.decline(sheet);

    const sheet = decision.offer.find((offered) => queue.canRequest(offered));
    if (!sheet || !bike || !calm) return;
    if (isConsentPromptOwed()) return;
    if (isPaywallInFlight()) {
      void paywallFlightSettled()?.then(requestRecheck);
      return;
    }
    const href = sheetHref(sheet, bike);
    if (!href) return;

    const timer = setTimeout(() => {
      if (!calmRef.current || isConsentPromptOwed() || isPaywallInFlight()) return;
      if (!queue.request(sheet)) return;
      router.push(href);
    }, LANDING_SHEET_DELAY_MS);
    return () => clearTimeout(timer);
  }, [bikes, bikesFailed, tasks, tasksFailed, calm, queueVersion, recheck, router]);
}
