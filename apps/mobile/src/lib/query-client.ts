import {
  MutationCache,
  onlineManager,
  QueryCache,
  QueryClient,
  type QueryMeta,
} from '@tanstack/react-query';
import { Alert } from 'react-native';
import { addBreadcrumb, captureException } from './analytics';
import { GRAPHQL_ERROR_CODE, HANDLED_GRAPHQL_CAPTURE_SOURCE } from './graphql-error-classification';
import { hasGraphQLCode, userFriendlyError } from './graphql-errors';
import { isNetworkError } from './network-error';
import { QUERY_CRITICALITY, type QueryCriticality, resolveCriticality } from './query-criticality';
import { isProviderSideFailure, isUpstreamHttpError } from './upstream-http-error';

declare module '@tanstack/react-query' {
  interface Register {
    queryMeta: {
      /**
       * When false, global query error UI is skipped (default: show on first-load
       * failures only). Honoured only when EVERY observer of the key passes it —
       * see `resolveFailureHandling`.
       */
      showErrorAlert?: boolean;
      /**
       * How much the user depends on this query. Absent ⇒ CRITICAL.
       * ENHANCEMENT suppresses BOTH the error-severity Sentry capture AND the
       * global alert — but only for a PROVIDER-side failure. Our own bugs
       * inside the query still report. See `query-criticality.ts`.
       */
      criticality?: QueryCriticality;
    };
    /**
     * `criticality` is deliberately absent here: a failed write is never
     * decorative. Per-error mutation exceptions go through the narrower
     * `skipSentryCapture` predicate instead.
     */
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

/** Why a query failure was recorded as a breadcrumb instead of a Sentry error. */
export const DOWNGRADE_REASON = {
  /** Device connectivity: offline, backgrounded, DNS, TLS, timeout. */
  TRANSPORT: 'transport',
  /** Our API reported one of ITS upstreams down (GraphQL SERVICE_UNAVAILABLE). */
  UPSTREAM_OUTAGE: 'upstream-outage',
  /** A third party we call directly failed, on a query declared ENHANCEMENT. */
  PROVIDER_OUTAGE_NON_CRITICAL: 'provider-outage-non-critical',
} as const;

export type DowngradeReason = (typeof DOWNGRADE_REASON)[keyof typeof DOWNGRADE_REASON];

interface DowngradeRule {
  readonly reason: DowngradeReason;
  readonly matches: (error: unknown, criticality: QueryCriticality) => boolean;
}

/**
 * Evaluated in order; the FIRST match wins and downgrades the capture to a
 * breadcrumb. A rule must only ever match a failure that is (a) provably not
 * our code and (b) non-actionable client-side.
 *
 * Rule 1 — transport-level failures are non-actionable regardless of what
 * onlineManager reports (flaky cellular, DNS failure, backgrounded fetch);
 * TanStack Query already retries them. (Sentry MOTO-VAULT-REACT-NATIVE-22 /
 * -23 / -26 / -1Y)
 *
 * Rule 2 — SERVICE_UNAVAILABLE means an upstream dependency of our API is down
 * (e.g. NHTSA vPIC behind motorcycleMakes). The API's own Sentry captures the
 * server-side failure with full context. (Sentry MOTO-VAULT-REACT-NATIVE-1M)
 *
 * Rule 3 requires TWO independent signals — a typed provider-side
 * `UpstreamHttpError` AND an explicit ENHANCEMENT declaration at the call
 * site. Neither alone is sufficient. That conjunction is what makes this a
 * principled filter rather than a message blocklist: a provider outage on a
 * CRITICAL query still pages us, and our own exception inside an ENHANCEMENT
 * query still pages us. (Sentry MOTO-VAULT-REACT-NATIVE-35)
 */
const QUERY_DOWNGRADE_RULES: readonly DowngradeRule[] = [
  {
    reason: DOWNGRADE_REASON.TRANSPORT,
    matches: (error) => isNetworkError(error),
  },
  {
    reason: DOWNGRADE_REASON.UPSTREAM_OUTAGE,
    matches: (error) => hasGraphQLCode(error, GRAPHQL_ERROR_CODE.SERVICE_UNAVAILABLE),
  },
  {
    reason: DOWNGRADE_REASON.PROVIDER_OUTAGE_NON_CRITICAL,
    matches: (error, criticality) =>
      criticality === QUERY_CRITICALITY.ENHANCEMENT &&
      isUpstreamHttpError(error) &&
      isProviderSideFailure(error.status),
  },
];

/**
 * The reason this failure should be downgraded to a breadcrumb, or null to
 * report it to Sentry. Exported so it can be driven directly in tests without
 * constructing a QueryClient — the same testability shape as `sentryBeforeSend`.
 */
export function downgradeReasonFor(
  error: unknown,
  criticality: QueryCriticality,
): DowngradeReason | null {
  return QUERY_DOWNGRADE_RULES.find((rule) => rule.matches(error, criticality))?.reason ?? null;
}

/** What `resolveFailureHandling` reads off a failed query: its own meta and its observers'. */
export interface FailedQueryMetaSource {
  meta?: QueryMeta;
  observers?: ReadonlyArray<{ options: { meta?: QueryMeta; enabled?: unknown } }>;
}

export interface FailureHandling {
  criticality: QueryCriticality;
  /** Every observer renders the failure itself, so the global alert stays away. */
  alertOptOut: boolean;
}

/** An observer that shows the failure itself — inline error, or nothing on a decorative surface. */
const ownsFailureUi = (meta: QueryMeta | undefined): boolean =>
  meta?.showErrorAlert === false ||
  resolveCriticality(meta?.criticality) === QUERY_CRITICALITY.ENHANCEMENT;

/**
 * How a failed query is handled, decided over EVERY observer of it — never off
 * `query.meta` alone.
 *
 * Observers of one key share one `Query`, and each render's
 * `QueryObserver.setOptions` writes that observer's options (meta included)
 * onto it, so `query.meta` is whatever the LAST-rendered observer passed. The
 * hub's opt-out leaked onto legacy screens sharing a key, or was lost to them,
 * depending on render order.
 *
 * Reading each observer's own options makes the answer order-independent, and
 * the rule is fail-safe: one observer without its own error UI keeps the alert
 * (and CRITICAL keeps its Sentry capture), so a forgotten opt-out costs a
 * duplicate alert, never a silent "no data". With no observer (a prefetch or
 * `fetchQuery`) the query's own meta — the one call's options — decides.
 *
 * An observer with `enabled: false` is left out: it subscribes (so it sits in
 * `query.observers`) but never asked for the fetch, and would otherwise veto
 * every other observer's opt-out — the Home checklist's disabled bike-list read
 * raised a system alert over Home's own error card. A function-valued `enabled`
 * still counts (fail-safe: the alert stays).
 */
export function resolveFailureHandling(query: FailedQueryMetaSource | undefined): FailureHandling {
  const observers = (query?.observers ?? []).filter(
    (observer) => observer.options.enabled !== false,
  );
  const metas =
    observers.length > 0 ? observers.map((observer) => observer.options.meta) : [query?.meta];
  const allEnhancement = metas.every(
    (meta) => resolveCriticality(meta?.criticality) === QUERY_CRITICALITY.ENHANCEMENT,
  );
  return {
    criticality: allEnhancement ? QUERY_CRITICALITY.ENHANCEMENT : QUERY_CRITICALITY.CRITICAL,
    alertOptOut: metas.every(ownsFailureUi),
  };
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
      if (hasGraphQLCode(error, GRAPHQL_ERROR_CODE.UNAUTHENTICATED)) {
        // gqlFetcher owns the (de-duped) refresh-and-retry on UNAUTHENTICATED.
        // Here we only suppress the global error alert + Sentry noise.
        return;
      }

      const { criticality, alertOptOut } = resolveFailureHandling(query);
      const downgradeReason = downgradeReasonFor(error, criticality);

      // Known-offline failures stay fully silent (no alert): the UI's offline
      // affordances already communicate the state.
      if (downgradeReason === DOWNGRADE_REASON.TRANSPORT && !onlineManager.isOnline()) return;

      if (downgradeReason !== null) {
        addBreadcrumb(
          error instanceof Error ? error.message : String(error),
          HANDLED_GRAPHQL_CAPTURE_SOURCE.QUERY_CACHE,
          {
            queryKey: JSON.stringify(query?.queryKey),
            reason: downgradeReason,
          },
        );
      } else {
        captureException(error, {
          queryKey: JSON.stringify(query?.queryKey),
          source: HANDLED_GRAPHQL_CAPTURE_SOURCE.QUERY_CACHE,
        });
      }

      // --- user-facing alert -------------------------------------------------
      // An ENHANCEMENT surface must never raise a modal: by its entry criteria
      // the consuming component already renders nothing on absence, so an alert
      // would interrupt the rider about something that was successfully hidden.
      // (Sentry MOTO-VAULT-REACT-NATIVE-35 — the user-facing half of that bug.)
      // Same for `showErrorAlert: false` — but only when EVERY observer says so.
      if (alertOptOut) return;
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
          source: HANDLED_GRAPHQL_CAPTURE_SOURCE.MUTATION_CACHE,
        });
      }
      if (mutation.options.onError) return;
      if (mutation.meta?.showErrorAlert === false) return;
      Alert.alert('Error', userFriendlyError(error));
    },
  }),
});
