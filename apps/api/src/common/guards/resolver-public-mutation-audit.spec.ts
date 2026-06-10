import 'reflect-metadata';
import { describe, expect, it } from 'vitest';
import { AffiliatesResolver } from '../../modules/affiliates/affiliates.resolver';
import { AiBudgetResolver } from '../../modules/ai-budget/ai-budget.resolver';
import { ArticlesResolver } from '../../modules/articles/articles.resolver';
import { CommentsResolver } from '../../modules/comments/comments.resolver';
import { ContentFlagsResolver } from '../../modules/content-flags/content-flags.resolver';
import { DiagnosticsResolver } from '../../modules/diagnostics/diagnostics.resolver';
import { EntitlementsResolver } from '../../modules/entitlements/entitlements.resolver';
import { ExpensesResolver } from '../../modules/expenses/expenses.resolver';
import { FeedResolver } from '../../modules/feed/feed.resolver';
import { FollowsResolver } from '../../modules/follows/follows.resolver';
import { FuelLogsResolver } from '../../modules/fuel-logs/fuel-logs.resolver';
import { FuelStopsResolver } from '../../modules/fuel-stops/fuel-stops.resolver';
import { GroupRidesResolver } from '../../modules/group-rides/group-rides.resolver';
import { HealthReportsResolver } from '../../modules/health-reports/health-reports.resolver';
import { InsightsResolver } from '../../modules/insights/insights.resolver';
import { KudosResolver } from '../../modules/kudos/kudos.resolver';
import { LearningProgressResolver } from '../../modules/learning-progress/learning-progress.resolver';
import { MaintenanceTasksResolver } from '../../modules/maintenance-tasks/maintenance-tasks.resolver';
import { MotorcyclesResolver } from '../../modules/motorcycles/motorcycles.resolver';
import { OemSchedulesResolver } from '../../modules/oem-schedules/oem-schedules.resolver';
import { PlacesResolver } from '../../modules/places/places.resolver';
import { QuizzesResolver } from '../../modules/quizzes/quizzes.resolver';
import { RideAnalyticsResolver } from '../../modules/ride-analytics/ride-analytics.resolver';
import { RideSummariesResolver } from '../../modules/ride-summaries/ride-summaries.resolver';
import { RidesResolver } from '../../modules/rides/rides.resolver';
import { SearchResolver } from '../../modules/search/search.resolver';
import { ShareLinksResolver } from '../../modules/share-links/share-links.resolver';
import { SponsorshipsResolver } from '../../modules/sponsorships/sponsorships.resolver';
import { SurfaceReportsResolver } from '../../modules/surface-reports/surface-reports.resolver';
import { TripAssistantResolver } from '../../modules/trip-assistant/trip-assistant.resolver';
import { TripSuggestionsResolver } from '../../modules/trip-suggestions/trip-suggestions.resolver';
import { TripsResolver } from '../../modules/trips/trips.resolver';
import { UsersResolver } from '../../modules/users/users.resolver';
import { WaitlistResolver } from '../../modules/waitlist/waitlist.resolver';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Guard audit, generalized across EVERY resolver (audit: praised the per-module
 * variant as a "model citizen" — this is the cheap, codebase-wide version).
 *
 * `GqlAuthGuard` is global; `@Public()` (class- or method-level) is the only opt-out.
 * A `@Public()` MUTATION means an unauthenticated caller can WRITE — almost always a
 * bug. This scans every resolver, identifies mutations via the GraphQL decorator's
 * own `graphql:resolver_type` metadata, and asserts none are public unless explicitly
 * allow-listed.
 *
 * `@Public()` resolution mirrors the guard's `reflector.getAllAndOverride(IS_PUBLIC_KEY,
 * [handler, class])`: a method is public if EITHER its own metadata or its class
 * metadata is true (WaitlistResolver opts out at the class level).
 */
const ALL_RESOLVERS = [
  AffiliatesResolver,
  AiBudgetResolver,
  ArticlesResolver,
  CommentsResolver,
  ContentFlagsResolver,
  DiagnosticsResolver,
  EntitlementsResolver,
  ExpensesResolver,
  FeedResolver,
  FollowsResolver,
  FuelLogsResolver,
  FuelStopsResolver,
  GroupRidesResolver,
  HealthReportsResolver,
  InsightsResolver,
  KudosResolver,
  LearningProgressResolver,
  MaintenanceTasksResolver,
  MotorcyclesResolver,
  OemSchedulesResolver,
  PlacesResolver,
  QuizzesResolver,
  RideAnalyticsResolver,
  RideSummariesResolver,
  RidesResolver,
  SearchResolver,
  ShareLinksResolver,
  SponsorshipsResolver,
  SurfaceReportsResolver,
  TripAssistantResolver,
  TripSuggestionsResolver,
  TripsResolver,
  UsersResolver,
  WaitlistResolver,
] as const;

const RESOLVER_TYPE_KEY = 'graphql:resolver_type';

/**
 * Mutations that are public BY DESIGN. The RevenueCat webhook is a @Controller (not
 * a resolver) and is covered by controller-auth-inventory.spec.ts.
 *  - WaitlistResolver.joinWaitlist: pre-launch email capture, no auth, HMAC-free by design.
 */
const PUBLIC_MUTATION_ALLOWLIST = new Set<string>(['WaitlistResolver.joinWaitlist']);

const isPublic = (cls: { prototype: object }, methodFn: object) =>
  Reflect.getMetadata(IS_PUBLIC_KEY, methodFn) === true ||
  Reflect.getMetadata(IS_PUBLIC_KEY, cls) === true;

describe('resolver auth guard audit (no accidental @Public mutations)', () => {
  // Build the full list of [resolver, method] mutation pairs up front.
  const mutations: Array<{
    resolver: string;
    method: string;
    fn: object;
    cls: { prototype: object };
  }> = [];

  for (const Resolver of ALL_RESOLVERS) {
    const proto = Resolver.prototype as unknown as Record<string, unknown>;
    for (const name of Object.getOwnPropertyNames(proto)) {
      if (name === 'constructor') continue;
      const fn = proto[name];
      if (typeof fn !== 'function') continue;
      if (Reflect.getMetadata(RESOLVER_TYPE_KEY, fn) === 'Mutation') {
        mutations.push({
          resolver: Resolver.name,
          method: name,
          fn: fn as object,
          cls: Resolver,
        });
      }
    }
  }

  it('discovers a non-trivial set of mutations to audit (guards against an empty scan)', () => {
    expect(mutations.length).toBeGreaterThan(20);
  });

  for (const { resolver, method, fn, cls } of mutations) {
    const key = `${resolver}.${method}`;
    const allowed = PUBLIC_MUTATION_ALLOWLIST.has(key);
    it(`${key} is ${allowed ? 'intentionally @Public()' : 'NOT @Public()'}`, () => {
      expect(isPublic(cls, fn)).toBe(allowed);
    });
  }

  it('every allow-listed public mutation still exists (prunes stale allowlist entries)', () => {
    const found = new Set(mutations.map((m) => `${m.resolver}.${m.method}`));
    for (const allowed of PUBLIC_MUTATION_ALLOWLIST) {
      expect(found.has(allowed), `${allowed} in allowlist but no longer a mutation`).toBe(true);
    }
  });
});
