import { MutationCache, onlineManager, QueryCache, QueryClient } from '@tanstack/react-query';
import { Alert } from 'react-native';
import { addBreadcrumb, captureException } from './analytics';
import { hasGraphQLCode, userFriendlyError } from './graphql-errors';
import { isNetworkError } from './network-error';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /** When false, global query error UI is skipped (default: show on first-load failures only). */
      showErrorAlert?: boolean;
    };
    mutationMeta: {
      showErrorAlert?: boolean;
      /**
       * Skip Sentry capture for expected/benign errors. Pass `true` to always
       * skip, or a predicate to skip only for specific errors (e.g. idempotent
       * "already deleted" responses) while still reporting genuine failures.
       */
      skipSentryCapture?: boolean | ((error: unknown) => boolean);
    };
  }
}

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 2 * 60 * 1000,
      gcTime: 24 * 60 * 60 * 1000,
      retry: 3,
      retryDelay: (attempt) => Math.min(1000 * 2 ** attempt, 30000),
      networkMode: 'offlineFirst',
      // structuralSharing left at its v5 default (true): it preserves referential
      // identity of unchanged result subtrees across refetches, which is what lets
      // React.memo'd cards and memoized renderItems skip re-renders on background
      // refetch/focus/invalidation. Opt out per-query only if one returns
      // non-plain-object data that must not be structurally merged.
    },
    mutations: {
      retry: (failureCount, error) => {
        if (hasGraphQLCode(error, 'FORBIDDEN') || hasGraphQLCode(error, 'BAD_USER_INPUT')) {
          return false;
        }
        return failureCount < 1;
      },
      networkMode: 'offlineFirst',
    },
  },
  queryCache: new QueryCache({
    onError: (error, query) => {
      const isAuthError = hasGraphQLCode(error, 'UNAUTHENTICATED');
      if (isAuthError) {
        // gqlFetcher owns the (de-duped) refresh-and-retry on UNAUTHENTICATED.
        // Here we only suppress the global error alert + Sentry noise.
        return;
      }
      // Transport-level failures are non-actionable client-side regardless of
      // what onlineManager reports (flaky cellular, DNS failure, backgrounded
      // fetch) — TanStack Query already retries them. Breadcrumb instead of a
      // Sentry error, but still fall through to the user-facing alert below.
      // (Sentry MOTO-VAULT-REACT-NATIVE-22 / -23 / -26 / -1Y)
      const isTransportError = isNetworkError(error);
      // Known-offline failures stay fully silent (no alert): the UI's offline
      // affordances already communicate the state.
      if (isTransportError && !onlineManager.isOnline()) return;
      // SERVICE_UNAVAILABLE = an upstream dependency of the API is down (e.g.
      // NHTSA vPIC behind motorcycleMakes). The API's own Sentry captures the
      // server-side failure with full context; a client event adds only noise.
      // (Sentry MOTO-VAULT-REACT-NATIVE-1M)
      const isUpstreamOutage = hasGraphQLCode(error, 'SERVICE_UNAVAILABLE');
      if (isTransportError || isUpstreamOutage) {
        addBreadcrumb(
          error instanceof Error ? error.message : String(error),
          'queryCache.onError',
          {
            queryKey: JSON.stringify(query?.queryKey),
          },
        );
      } else {
        captureException(error, {
          queryKey: JSON.stringify(query?.queryKey),
          source: 'queryCache.onError',
        });
      }
      if (query?.meta?.showErrorAlert === false) return;
      if (query?.state.data !== undefined) return;
      Alert.alert('Error', userFriendlyError(error));
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _variables, _context, mutation) => {
      const skip = mutation.meta?.skipSentryCapture;
      const shouldSkipCapture = typeof skip === 'function' ? skip(error) : skip === true;
      if (!shouldSkipCapture) {
        captureException(error, {
          mutationKey: JSON.stringify(mutation.options.mutationKey),
          source: 'mutationCache.onError',
        });
      }
      if (mutation.options.onError) return;
      if (mutation.meta?.showErrorAlert === false) return;
      Alert.alert('Error', userFriendlyError(error));
    },
  }),
});
