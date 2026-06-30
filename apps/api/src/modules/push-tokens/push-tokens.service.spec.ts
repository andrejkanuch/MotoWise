import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it } from 'vitest';
import { PushTokensService } from './push-tokens.service';

/** Chainable Supabase stub whose terminal awaits to `result`. */
function makeUserClient(result: { data?: unknown; error?: unknown }) {
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'upsert', 'select']) {
    builder[m] = () => builder;
  }
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub for the awaited Supabase builder.
  builder.then = (resolve: (v: unknown) => unknown) => resolve(result);
  return builder as unknown as SupabaseClient;
}

const INPUT = { token: 'ExponentPushToken[abc]', platform: 'ios' };

describe('PushTokensService.register', () => {
  it('returns true when the upsert writes a row', async () => {
    const service = new PushTokensService(makeUserClient({ data: [{ id: 'row-1' }], error: null }));
    await expect(service.register('u1', INPUT)).resolves.toBe(true);
  });

  it('returns false on a cross-user no-op (RLS filtered the row → empty result)', async () => {
    const service = new PushTokensService(makeUserClient({ data: [], error: null }));
    await expect(service.register('u1', INPUT)).resolves.toBe(false);
  });

  it('throws InternalServerErrorException when the upsert errors', async () => {
    const service = new PushTokensService(
      makeUserClient({ data: null, error: { message: 'boom', code: 'XX000' } }),
    );
    await expect(service.register('u1', INPUT)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});
