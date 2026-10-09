import 'reflect-metadata';
import { InternalServerErrorException } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { describe, expect, it, vi } from 'vitest';
import { PushTokensService } from './push-tokens.service';

type Result = { data?: unknown; error?: unknown };

/** Supabase user-client stub: `rpc` resolves to `rpcResult`; the builder chain awaits to `queryResult`. */
function makeUserClient({
  rpcResult = {},
  queryResult = {},
}: {
  rpcResult?: Result;
  queryResult?: Result;
}) {
  const calls: { method: string; args: unknown[] }[] = [];
  const builder: Record<string, unknown> = {};
  for (const m of ['from', 'delete', 'eq']) {
    builder[m] = (...args: unknown[]) => {
      calls.push({ method: m, args });
      return builder;
    };
  }
  // biome-ignore lint/suspicious/noThenProperty: intentional thenable stub for the awaited Supabase builder.
  builder.then = (resolve: (v: unknown) => unknown) => resolve(queryResult);
  builder.rpc = vi.fn(async (...args: unknown[]) => {
    calls.push({ method: 'rpc', args });
    return rpcResult;
  });
  return { client: builder as unknown as SupabaseClient, calls };
}

const INPUT = { token: 'ExponentPushToken[abc]', platform: 'ios' };

describe('PushTokensService.register', () => {
  it('claims the token through the RPC and returns true', async () => {
    const { client, calls } = makeUserClient({ rpcResult: { data: true, error: null } });
    await expect(new PushTokensService(client).register('u1', INPUT)).resolves.toBe(true);
    expect(calls).toEqual([
      {
        method: 'rpc',
        args: ['claim_device_push_token', { p_token: INPUT.token, p_platform: INPUT.platform }],
      },
    ]);
  });

  it('returns false when the RPC refuses (no signed-in user in the database)', async () => {
    const { client } = makeUserClient({ rpcResult: { data: false, error: null } });
    await expect(new PushTokensService(client).register('u1', INPUT)).resolves.toBe(false);
  });

  it('throws InternalServerErrorException when the RPC errors', async () => {
    const { client } = makeUserClient({
      rpcResult: { data: null, error: { message: 'boom', code: 'XX000' } },
    });
    await expect(new PushTokensService(client).register('u1', INPUT)).rejects.toBeInstanceOf(
      InternalServerErrorException,
    );
  });
});

describe('PushTokensService.unregister', () => {
  it("deletes only the caller's row for that token", async () => {
    const { client, calls } = makeUserClient({ queryResult: { data: null, error: null } });
    await expect(new PushTokensService(client).unregister('u1', INPUT.token)).resolves.toBe(true);
    expect(calls).toEqual([
      { method: 'from', args: ['device_push_tokens'] },
      { method: 'delete', args: [] },
      { method: 'eq', args: ['token', INPUT.token] },
      { method: 'eq', args: ['user_id', 'u1'] },
    ]);
  });

  it('throws InternalServerErrorException when the delete errors', async () => {
    const { client } = makeUserClient({
      queryResult: { data: null, error: { message: 'boom', code: 'XX000' } },
    });
    await expect(
      new PushTokensService(client).unregister('u1', INPUT.token),
    ).rejects.toBeInstanceOf(InternalServerErrorException);
  });
});
