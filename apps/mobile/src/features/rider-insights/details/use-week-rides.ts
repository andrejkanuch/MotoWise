import { useInfiniteQuery } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo } from 'react';
import { myRidesOptions } from '@/lib/query-options';
import { type MyRide, needsOlderRides, ridesInWeek } from './season-model';

export interface WeekRides {
  rides: MyRide[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
}

/**
 * The rides of one week (`weekStart`, a Monday), from the rider's own ride
 * list: it pages back until a loaded ride is older than the week or the list
 * ends. Shares My rides' cache, so pages already loaded there are not asked
 * for again. Idle while `weekStart` is null.
 */
export function useWeekRides(weekStart: string | null): WeekRides {
  const query = useInfiniteQuery({ ...myRidesOptions(), enabled: weekStart !== null });
  const { data, hasNextPage, isFetchingNextPage, isError, isFetchNextPageError } = query;
  const { fetchNextPage, refetch } = query;

  const loaded = useMemo(
    () =>
      (data?.pages ?? []).flatMap((page) => page?.myRides?.edges.map((edge) => edge.node) ?? []),
    [data?.pages],
  );
  const older =
    weekStart !== null && data !== undefined && needsOlderRides(loaded, weekStart, hasNextPage);

  // Keyed on the page count too: a page that lands between two renders leaves
  // `older` and `isFetchingNextPage` as they were, and the next ask must still go.
  const pages = data?.pages.length ?? 0;
  useEffect(() => {
    if (pages > 0 && older && !isFetchingNextPage && !isError) void fetchNextPage();
  }, [older, isFetchingNextPage, isError, fetchNextPage, pages]);

  const retry = useCallback(() => {
    void (isFetchNextPageError ? fetchNextPage() : refetch());
  }, [isFetchNextPageError, fetchNextPage, refetch]);

  const rides = useMemo(
    () => (weekStart && !older ? ridesInWeek(loaded, weekStart) : []),
    [loaded, weekStart, older],
  );

  // A failed refresh does not hide a week the loaded pages already cover.
  const missing = weekStart !== null && (data === undefined || older);
  return { rides, loading: missing && !isError, failed: missing && isError, retry };
}
