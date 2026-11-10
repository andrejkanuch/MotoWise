import { vi } from 'vitest';
import { PG_ERROR } from '../../../common/supabase/unwrap';

/**
 * A service-role client fake for the rider insights reads: the users row the
 * tier is resolved from, the rider's latest device zone, and RPC answers keyed
 * by RPC name (a function receives the call's arguments).
 */
export interface FakeAdminOptions {
  /** The users row resolveTier reads; null answers "no row". */
  tierRow?: {
    subscription_tier: string;
    subscription_status: string;
    subscription_expires_at: string | null;
  } | null;
  /** time_zone of the rider's latest ride_private_details row. */
  latestZone?: string | null;
  rpc?: Record<string, (args: Record<string, unknown>) => unknown>;
  /** Called on every table read, for ordering assertions. */
  onRead?: (what: string) => void;
}

export const FREE_ROW = {
  subscription_tier: 'free',
  subscription_status: 'active',
  subscription_expires_at: null,
};
export const PRO_ROW = {
  subscription_tier: 'pro',
  subscription_status: 'active',
  subscription_expires_at: '2099-01-01T00:00:00Z',
};

export function fakeAdmin(options: FakeAdminOptions) {
  const rpcCalls: Array<{ name: string; args: Record<string, unknown> }> = [];

  const from = vi.fn((table: string) => {
    options.onRead?.(table);
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'not', 'order', 'limit', 'in']) chain[m] = () => chain;
    const tierResult = () =>
      options.tierRow
        ? { data: options.tierRow, error: null }
        : { data: null, error: { message: 'no rows', code: PG_ERROR.NOT_FOUND } };
    const zoneResult = () => ({
      data: options.latestZone ? { time_zone: options.latestZone } : null,
      error: null,
    });
    chain.single = async () => tierResult();
    chain.maybeSingle = async () => (table === 'users' ? tierResult() : zoneResult());
    return chain;
  });

  const rpc = vi.fn(async (name: string, args: Record<string, unknown>) => {
    options.onRead?.(`rpc:${name}`);
    rpcCalls.push({ name, args });
    const answer = options.rpc?.[name];
    if (!answer) return { data: null, error: { message: `unexpected rpc ${name}`, code: 'XX000' } };
    return { data: answer(args), error: null };
  });

  return { client: { from, rpc } as never, rpcCalls, from, rpc };
}
