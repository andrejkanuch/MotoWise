import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import type { RevalidationService } from '../../../../common/revalidation/revalidation.service';
import { tripTemplateRevalidation } from '../../trip-revalidation';
import { TripLifecycleService } from '../trip-lifecycle.service';
import { TripReviewsService } from '../trip-reviews.service';
import { TripTemplatesService } from '../trip-templates.service';

/**
 * The web caches explore + trip pages for 30 days, so mutations that change what
 * they show must call the revalidation endpoint. These tests pin that wiring.
 */

type Result = { data: unknown; error: unknown };

/**
 * Supabase client stub: each `from()` call takes the next queued result. Every
 * builder method chains, and the builder resolves (thenable or `.single()` /
 * `.maybeSingle()`) with that result.
 */
function clientStub(results: Result[]) {
  let call = 0;
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
  return { from } as unknown as SupabaseClient;
}

const templateRow = {
  is_template: true,
  country_code: 'CA',
  region_code: 'BC',
  slug: 'sea-to-sky',
};
const expected = tripTemplateRevalidation('CA', 'BC', 'sea-to-sky');

function revalidationMock() {
  const revalidate = vi.fn();
  return { revalidate, service: { revalidate } as unknown as RevalidationService };
}

describe('trip mutations refresh the cached explore + trip pages', () => {
  it('moderateTemplate revalidates the flagged template', async () => {
    const { revalidate, service } = revalidationMock();
    const admin = clientStub([
      { data: { role: 'admin' }, error: null },
      { data: { id: 't1', ...templateRow }, error: null },
    ]);
    const templates = new TripTemplatesService(clientStub([]), admin, service);

    await templates.moderateTemplate('admin-1', { tripId: 't1', isFlagged: true });

    expect(revalidate).toHaveBeenCalledWith(expected);
  });

  it('deleteTrip revalidates a deleted template but not a private trip', async () => {
    const { revalidate, service } = revalidationMock();
    const organiser = { data: { organiser_user_id: 'u1', status: 'draft' }, error: null };
    const lifecycle = new TripLifecycleService(
      clientStub([organiser, { data: templateRow, error: null }]),
      clientStub([]),
      service,
    );
    await lifecycle.deleteTrip('u1', 't1');
    expect(revalidate).toHaveBeenCalledWith(expected);

    revalidate.mockClear();
    const privateTrip = new TripLifecycleService(
      clientStub([organiser, { data: { is_template: false }, error: null }]),
      clientStub([]),
      service,
    );
    await privateTrip.deleteTrip('u1', 't2');
    expect(revalidate).not.toHaveBeenCalled();
  });

  it('deleteReview revalidates the reviewed template', async () => {
    const { revalidate, service } = revalidationMock();
    const reviews = new TripReviewsService(
      clientStub([{ data: { id: 'r1', trip_id: 't1' }, error: null }]),
      clientStub([{ data: templateRow, error: null }]),
      service,
    );

    await reviews.deleteReview('u1', 'r1');

    expect(revalidate).toHaveBeenCalledWith(expected);
  });
});
