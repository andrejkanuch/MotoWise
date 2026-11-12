import {
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { CommentsService } from './comments.service';

const USER_ID = 'u1';
const TRIP_ID = '33333333-3333-4333-8333-333333333333';

const insertedRow = {
  id: 'c1',
  text: 'Great trip',
  created_at: '2026-11-11T16:06:25Z',
  flagged_count: 0,
  parent_comment_id: null,
  user_id: USER_ID,
  users: { id: USER_ID, display_name: 'Ann', public_username: null, avatar_url: null },
};

type InsertResult = { data: unknown; error: { code: string; message: string } | null };

/** A user client whose insert(...).select(...).single() resolves to `result`. */
function clientReturning(result: InsertResult) {
  const chain = {
    insert: vi.fn(),
    select: vi.fn(),
    single: vi.fn().mockResolvedValue(result),
  };
  chain.insert.mockReturnValue(chain);
  chain.select.mockReturnValue(chain);
  const client = { from: vi.fn().mockReturnValue(chain) };
  return { client: client as unknown as SupabaseClient, chain };
}

const pgError = (code: string, message: string) => ({
  data: null,
  error: { code, message, details: '', hint: '' },
});

describe('CommentsService.createComment', () => {
  let service: CommentsService;
  let chain: ReturnType<typeof clientReturning>['chain'];

  const create = () => service.createComment(USER_ID, { tripId: TRIP_ID, text: 'Great trip' });

  const withResult = (result: InsertResult) => {
    const built = clientReturning(result);
    chain = built.chain;
    service = new CommentsService(built.client);
  };

  beforeEach(() => {
    withResult({ data: insertedRow, error: null });
  });

  it('inserts a trip-only comment with every other target null', async () => {
    const comment = await create();

    expect(chain.insert).toHaveBeenCalledWith({
      user_id: USER_ID,
      ride_id: null,
      route_id: null,
      group_ride_id: null,
      trip_id: TRIP_ID,
      parent_comment_id: null,
      text: 'Great trip',
    });
    expect(comment).toMatchObject({ id: 'c1', author: { id: USER_ID, displayName: 'Ann' } });
  });

  it('maps an RLS rejection (42501) to Forbidden', async () => {
    withResult(
      pgError(PG_ERROR.INSUFFICIENT_PRIVILEGE, 'new row violates row-level security policy'),
    );
    await expect(create()).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('maps a vanished target (23503) to NotFound', async () => {
    withResult(pgError(PG_ERROR.FOREIGN_KEY_VIOLATION, 'violates foreign key constraint'));
    await expect(create()).rejects.toBeInstanceOf(NotFoundException);
  });

  it('maps a rejected session token to Unauthorized', async () => {
    withResult(pgError(PG_ERROR.JWT_INVALID, 'JWT expired'));
    await expect(create()).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('keeps a CHECK violation a 500 and carries the Postgres error as cause', async () => {
    withResult(
      pgError(
        PG_ERROR.CHECK_VIOLATION,
        'new row for relation "comments" violates check constraint "comments_single_target"',
      ),
    );

    const err = await create().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(InternalServerErrorException);
    expect((err as Error).cause).toBeInstanceOf(Error);
    expect(((err as Error).cause as Error).message).toContain('comments_single_target');
  });
});
