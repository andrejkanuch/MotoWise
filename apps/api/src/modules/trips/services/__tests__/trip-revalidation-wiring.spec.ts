import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { RevalidationService } from '../../../../common/revalidation/revalidation.service';
import { tripTemplateRevalidation } from '../../trip-revalidation';
import { TripLifecycleService } from '../trip-lifecycle.service';
import { TripPageRevalidator } from '../trip-page-revalidator.service';
import { TripReviewsService } from '../trip-reviews.service';
import { TripTemplatesService } from '../trip-templates.service';
import { TripWaypointsService } from '../trip-waypoints.service';

/**
 * The web caches explore + trip pages for 30 days, so every mutation that changes
 * what they show must call the revalidation endpoint. These tests pin that wiring.
 */

type Result = { data: unknown; error: unknown };

/**
 * Supabase client stub: each `from()` call takes the next queued result, and each
 * `rpc()` call the next queued RPC result. Every builder method chains, and the
 * builder resolves (thenable or `.single()` / `.maybeSingle()`) with that result.
 */
function clientStub(results: Result[], rpcResults: Result[] = []) {
  let call = 0;
  let rpcCall = 0;
  const from = vi.fn(() => {
    const result = results[Math.min(call, results.length - 1)];
    call += 1;
    const builder: Record<string, unknown> = {};
    for (const method of ['select', 'update', 'delete', 'insert', 'eq', 'limit', 'order']) {
      builder[method] = vi.fn(() => builder);
    }
    builder.single = vi.fn(async () => result);
    builder.maybeSingle = vi.fn(async () => result);
    // biome-ignore lint/suspicious/noThenProperty: mocking PostgREST's thenable builder
    builder.then = (resolve: (value: Result) => unknown) => Promise.resolve(result).then(resolve);
    return builder;
  });
  const rpc = vi.fn(async () => {
    const result = rpcResults[Math.min(rpcCall, rpcResults.length - 1)];
    rpcCall += 1;
    return result;
  });
  return { from, rpc } as unknown as SupabaseClient;
}

const ok = (data: unknown): Result => ({ data, error: null });
const failed: Result = { data: null, error: { message: 'boom', code: 'XX000' } };

const templateRow = {
  is_template: true,
  country_code: 'CA',
  region_code: 'BC',
  slug: 'sea-to-sky',
};
const expected = tripTemplateRevalidation('CA', 'BC', 'sea-to-sky');
const organiser = ok({ organiser_user_id: 'u1', status: 'draft' });
const waypointRow = { id: 'w1', trip_id: 't1', sort_order: 0, day_index: 0, type: 'stop' };

/**
 * A real TripPageRevalidator over a stubbed admin client (its trip lookups) and a
 * mocked RevalidationService (the HTTP call under test).
 */
function pages(adminResults: Result[] = [ok(templateRow)]) {
  const revalidate = vi.fn();
  const revalidation = { revalidate } as unknown as RevalidationService;
  return {
    revalidate,
    revalidation,
    tripPages: new TripPageRevalidator(clientStub(adminResults), revalidation),
  };
}

describe('trip mutations refresh the cached explore + trip pages', () => {
  describe('moderateTemplate', () => {
    it.each([true, false])('revalidates when isFlagged is %s', async (isFlagged) => {
      const { revalidate, revalidation, tripPages } = pages();
      const admin = clientStub([ok({ role: 'admin' }), ok({ id: 't1', ...templateRow })]);
      const templates = new TripTemplatesService(clientStub([]), admin, revalidation, tripPages);

      await templates.moderateTemplate('admin-1', { tripId: 't1', isFlagged });

      expect(revalidate).toHaveBeenCalledWith(expected);
    });
  });

  describe('deleteTrip', () => {
    it('revalidates a deleted template', async () => {
      const { revalidate, tripPages } = pages();
      const lifecycle = new TripLifecycleService(
        clientStub([organiser, ok(templateRow)]),
        clientStub([]),
        tripPages,
      );
      await lifecycle.deleteTrip('u1', 't1');
      expect(revalidate).toHaveBeenCalledWith(expected);
    });

    it('does not revalidate a private trip', async () => {
      const { revalidate, tripPages } = pages();
      const lifecycle = new TripLifecycleService(
        clientStub([organiser, ok({ is_template: false })]),
        clientStub([]),
        tripPages,
      );
      await lifecycle.deleteTrip('u1', 't2');
      expect(revalidate).not.toHaveBeenCalled();
    });
  });

  describe('updateTrip', () => {
    it('revalidates an edited template', async () => {
      const { revalidate, tripPages } = pages();
      const lifecycle = new TripLifecycleService(
        clientStub([organiser, ok({ id: 't1', title: 'New' })]),
        clientStub([]),
        tripPages,
      );
      await lifecycle.updateTrip('u1', 't1', { title: 'New' });
      expect(revalidate).toHaveBeenCalledWith(expected);
    });

    it('does not revalidate a non-template trip', async () => {
      const { revalidate, tripPages } = pages([ok({ is_template: false })]);
      const lifecycle = new TripLifecycleService(
        clientStub([organiser, ok({ id: 't1', title: 'New' })]),
        clientStub([]),
        tripPages,
      );
      await lifecycle.updateTrip('u1', 't1', { title: 'New' });
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('still revalidates when the waypoint replace fails after the trip row was saved', async () => {
      const { revalidate, tripPages } = pages();
      const lifecycle = new TripLifecycleService(
        clientStub([organiser, ok({ id: 't1', title: 'New' })], [failed]),
        clientStub([]),
        tripPages,
      );
      // biome-ignore lint/suspicious/noExplicitAny: silence the expected error log
      vi.spyOn((lifecycle as any).logger, 'error').mockImplementation(() => undefined);

      await expect(
        lifecycle.updateTrip('u1', 't1', {
          title: 'New',
          waypoints: [{ type: 'stop', name: 'A', lat: 0, lng: 0, sortOrder: 0 }],
        }),
      ).rejects.toThrow('Failed to update trip waypoints');
      expect(revalidate).toHaveBeenCalledWith(expected);
    });
  });

  it('shareRideAsTrip revalidates the new Discover template', async () => {
    const { revalidate, tripPages } = pages();
    const ride = { id: 'r1', user_id: 'u1', status: 'completed', route_polyline: 'abc' };
    const lifecycle = new TripLifecycleService(
      clientStub([ok(ride), ok(null), ok({ id: 't1', ...templateRow })]),
      clientStub([]),
      tripPages,
    );

    await lifecycle.shareRideAsTrip('u1', { rideId: 'r1' });

    expect(revalidate).toHaveBeenCalledWith(expected);
  });

  describe('reviews', () => {
    const review = ok({
      id: 'r1',
      trip_id: 't1',
      user_id: 'u1',
      rating: 5,
      created_at: '2026-01-01',
    });

    it('createReview revalidates the reviewed template', async () => {
      const { revalidate, tripPages } = pages();
      const reviews = new TripReviewsService(clientStub([review]), clientStub([]), tripPages);
      await reviews.createReview('u1', { tripId: 't1', rating: 5 });
      expect(revalidate).toHaveBeenCalledWith(expected);
    });

    it('createReview still succeeds and skips the refresh when the trip lookup fails', async () => {
      const { revalidate, tripPages } = pages([failed]);
      // biome-ignore lint/suspicious/noExplicitAny: silence the expected warn log
      vi.spyOn((tripPages as any).logger, 'warn').mockImplementation(() => undefined);
      const reviews = new TripReviewsService(clientStub([review]), clientStub([]), tripPages);

      await expect(reviews.createReview('u1', { tripId: 't1', rating: 5 })).resolves.toMatchObject({
        id: 'r1',
      });
      expect(revalidate).not.toHaveBeenCalled();
    });

    it('deleteReview revalidates the reviewed template', async () => {
      const { revalidate, tripPages } = pages();
      const reviews = new TripReviewsService(
        clientStub([ok({ id: 'r1', trip_id: 't1' })]),
        clientStub([]),
        tripPages,
      );
      await reviews.deleteReview('u1', 'r1');
      expect(revalidate).toHaveBeenCalledWith(expected);
    });
  });

  describe('waypoints', () => {
    const service = (userResults: Result[], adminRpc: Result[] = []) => {
      const { revalidate, tripPages } = pages();
      const waypoints = new TripWaypointsService(
        clientStub(userResults),
        clientStub([], adminRpc),
        tripPages,
      );
      return { revalidate, waypoints };
    };

    it('addWaypoint', async () => {
      const { revalidate, waypoints } = service([organiser, ok(waypointRow)]);
      await waypoints.addWaypoint('u1', {
        tripId: 't1',
        type: 'stop',
        name: 'A',
        lat: 0,
        lng: 0,
        sortOrder: 0,
      });
      expect(revalidate).toHaveBeenCalledWith(expected);
    });

    it('updateWaypoint', async () => {
      const { revalidate, waypoints } = service([
        ok({ trip_id: 't1' }),
        organiser,
        ok(waypointRow),
      ]);
      await waypoints.updateWaypoint('u1', 'w1', { name: 'B' });
      expect(revalidate).toHaveBeenCalledWith(expected);
    });

    it('removeWaypoint', async () => {
      const { revalidate, waypoints } = service([ok({ trip_id: 't1' }), organiser, ok(null)]);
      await waypoints.removeWaypoint('u1', 'w1');
      expect(revalidate).toHaveBeenCalledWith(expected);
    });

    it('reorderWaypoints', async () => {
      const { revalidate, waypoints } = service([organiser], [ok(null)]);
      await waypoints.reorderWaypoints('u1', 't1', ['w1']);
      expect(revalidate).toHaveBeenCalledWith(expected);
    });
  });
});
