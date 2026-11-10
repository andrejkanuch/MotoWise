import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { weekRidesOptions } from '@/lib/query-options';
import { type MyRide, needsOlderRides, ridesInWeek } from './season-model';

/** Pages walked before stopping to ask: 10 x 50 = the latest 500 rides. */
export const WEEK_RIDES_MAX_PAGES = 10;
const NEXT_PAGE = { cancelRefetch: false } as const;

export interface WeekRides {
  rides: MyRide[];
  loading: boolean;
  failed: boolean;
  /**
   * Paging stopped at the page cap before reaching the week: `rides` may miss
   * some, and `loadOlder` walks another `WEEK_RIDES_MAX_PAGES` pages.
   */
  truncated: boolean;
  /** Rides searched so far, for the truncated note. */
  searched: number;
  loadOlder: () => void;
  retry: () => void;
}

/**
 * The rides of one week (`weekStart`, a Monday), from the rider's ride list in
 * its own per-week cache entry: it pages back until a loaded ride is older than
 * the week, the list ends, or `WEEK_RIDES_MAX_PAGES` pages are in. Idle while
 * `weekStart` is null.
 */
export function useWeekRides(weekStart: string | null): WeekRides {
  const query = useInfiniteQuery({
    ...weekRidesOptions(weekStart ?? ''),
    enabled: weekStart !== null,
  });
  const { data, hasNextPage, isFetchingNextPage, isError, isFetchNextPageError } = query;
  const { fetchNextPage, refetch } = query;
  // The page cap, per week: a newly opened week starts from the default.
  const [extended, setExtended] = useState<{ week: string; limit: number } | null>(null);
  const limit = extended && extended.week === weekStart ? extended.limit : WEEK_RIDES_MAX_PAGES;

  const loaded = useMemo(
    () =>
      (data?.pages ?? []).flatMap((page) => page?.myRides?.edges.map((edge) => edge.node) ?? []),
    [data?.pages],
  );
  const pages = data?.pages.length ?? 0;
  const older =
    weekStart !== null && data !== undefined && needsOlderRides(loaded, weekStart, hasNextPage);
  const wantMore = older && pages < limit;

  // Keyed on the page count too: a page that lands between two renders leaves
  // `wantMore` and `isFetchingNextPage` as they were, and the next ask must still go.
  useEffect(() => {
    if (pages > 0 && wantMore && !isFetchingNextPage && !isError) void fetchNextPage(NEXT_PAGE);
  }, [wantMore, isFetchingNextPage, isError, fetchNextPage, pages]);

  const retry = useCallback(() => {
    void (isFetchNextPageError ? fetchNextPage(NEXT_PAGE) : refetch());
  }, [isFetchNextPageError, fetchNextPage, refetch]);

  const loadOlder = useCallback(() => {
    if (weekStart) setExtended({ week: weekStart, limit: pages + WEEK_RIDES_MAX_PAGES });
  }, [weekStart, pages]);

  const rides = useMemo(
    () => (weekStart && !wantMore ? ridesInWeek(loaded, weekStart) : []),
    [loaded, weekStart, wantMore],
  );

  // A failed refresh does not hide a week the loaded pages already cover.
  const missing = weekStart !== null && (data === undefined || wantMore);
  return {
    rides,
    loading: missing && !isError,
    failed: missing && isError,
    truncated: !missing && older,
    searched: loaded.length,
    loadOlder,
    retry,
  };
}
