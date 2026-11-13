import { useEffect, useRef } from 'react';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';

/** `screen_load_timed.screen` values. Discover only (issue 365 doc review 2026-11-12). */
export const SCREEN_LOAD_SCREEN = {
  DISCOVER: 'discover',
} as const;

/** How the first load ended: rides on screen, an empty list, an error, or still loading at the deadline. */
export const SCREEN_LOAD_OUTCOME = {
  CONTENT: 'content',
  EMPTY: 'empty',
  ERROR: 'error',
  TIMEOUT: 'timeout',
} as const;
type ScreenLoadOutcome = (typeof SCREEN_LOAD_OUTCOME)[keyof typeof SCREEN_LOAD_OUTCOME];

/** FS-PO7: the rider should see rides or an error + Retry within 10 s. */
export const DISCOVER_LOAD_TIMEOUT_MS = 10_000;

export interface DiscoverLoadState {
  /** The ride list query's `status`. `pending` covers a request parked offline too. */
  status: 'pending' | 'error' | 'success';
  itemCount: number;
}

function outcomeOf({ status, itemCount }: DiscoverLoadState): ScreenLoadOutcome | null {
  if (status === 'error') return SCREEN_LOAD_OUTCOME.ERROR;
  if (status === 'success') {
    return itemCount > 0 ? SCREEN_LOAD_OUTCOME.CONTENT : SCREEN_LOAD_OUTCOME.EMPTY;
  }
  return null;
}

/**
 * Discover's analytics: `discover_tab_viewed` on open, and `screen_load_timed`
 * (FS-PO7) once per open — the time from opening to the first settled ride list,
 * or `timeout` at {@link DISCOVER_LOAD_TIMEOUT_MS}. Later refetches (a filter, a
 * pull to refresh) are not timed. Closing before it settles reports nothing.
 */
export function useDiscoverAnalytics(state: DiscoverLoadState): void {
  const openedAt = useRef(Date.now());
  const reported = useRef(false);

  const report = (outcome: ScreenLoadOutcome) => {
    if (reported.current) return;
    reported.current = true;
    trackEvent(AnalyticsEvent.SCREEN_LOAD_TIMED, {
      screen: SCREEN_LOAD_SCREEN.DISCOVER,
      ms_to_content: Date.now() - openedAt.current,
      outcome,
    });
  };
  const reportRef = useRef(report);
  reportRef.current = report;

  useEffect(() => {
    trackEvent(AnalyticsEvent.DISCOVER_TAB_VIEWED);
    const timeout = setTimeout(
      () => reportRef.current(SCREEN_LOAD_OUTCOME.TIMEOUT),
      DISCOVER_LOAD_TIMEOUT_MS,
    );
    return () => clearTimeout(timeout);
  }, []);

  const outcome = outcomeOf(state);
  useEffect(() => {
    if (outcome) reportRef.current(outcome);
  }, [outcome]);
}
