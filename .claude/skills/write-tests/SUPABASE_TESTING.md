# Testing NestJS services that use Supabase

MotoVault services receive a `SupabaseClient` by constructor injection:

```ts
@Injectable()
export class FuelLogsService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}
}
```

So a test just constructs the service with a client of its choosing —
`new FuelLogsService(client)`. Two strategies, pick per the decision rule in `SKILL.md`.

---

## Strategy A — clean chainable mock (default)

The Supabase/PostgREST query builder is **chainable and awaitable**. Model that with a
single tiny helper that returns `{ data, error }` and lets every intermediate call chain.
This avoids the brittle `callIndex % n` anti-pattern: you set the *result*, not the call order.

```ts
import type { SupabaseClient } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { FuelLogsService } from '../fuel-logs.service';

/**
 * Build a Supabase client mock whose builder resolves to `result` for `.from(table)`.
 * Every builder method (select/eq/order/limit/single/upsert/...) returns the same
 * thenable, so any chain shape works and the test only declares the final data/error.
 */
function mockSupabase(resultByTable: Record<string, { data: unknown; error: unknown }>) {
  const make = (table: string) => {
    const result = resultByTable[table] ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const m of ['select', 'insert', 'update', 'upsert', 'delete', 'eq', 'in', 'order', 'limit', 'range', 'filter', 'is', 'gte', 'lte']) {
      builder[m] = vi.fn(() => builder);
    }
    builder.single = vi.fn(() => Promise.resolve(result));
    builder.maybeSingle = vi.fn(() => Promise.resolve(result));
    // Awaiting the builder itself resolves to the result (PostgREST is a thenable).
    builder.then = (onFulfilled: (v: unknown) => unknown) => Promise.resolve(result).then(onFulfilled);
    return builder;
  };
  return {
    from: vi.fn((table: string) => make(table)),
  } as unknown as SupabaseClient;
}

describe('FuelLogsService.list', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns fuel logs for the current user', async () => {
    // Arrange
    const rows = [{ id: '1', liters: 12, total_cost: 20 }];
    const service = new FuelLogsService(
      mockSupabase({ fuel_logs: { data: rows, error: null } }),
    );

    // Act
    const result = await service.list('user-1');

    // Assert — behavior + the camelCase mapping the service is responsible for
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({ totalCost: 20 });
  });

  it('throws when Supabase returns an error', async () => {
    const service = new FuelLogsService(
      mockSupabase({ fuel_logs: { data: null, error: { message: 'boom' } } }),
    );
    await expect(service.list('user-1')).rejects.toThrow();
  });
});
```

Assert on **returned data and the snake_case→camelCase mapping**, not on which builder
methods were called. If you find yourself asserting `expect(builder.eq).toHaveBeenCalledWith(...)`
to prove correctness, you're testing the mock, not the behavior — switch to Strategy B.

---

## Strategy B — real local Supabase (RLS / complex SQL)

Use when the logic *is* the database: RLS author checks, column-level grants (00141),
multi-table joins, or filters complex enough that a mock would just re-encode the SQL.
This is the honest MotoVault equivalent of the template's PGLite tests — RLS needs real
Postgres roles, which a mock can't reproduce.

**Prereq:** `pnpm db:start` (local stack — API on `:54321`, Postgres on `:54322`).

```ts
import { createClient } from '@supabase/supabase-js';
import { afterAll, beforeEach, describe, expect, it } from 'vitest';

const LOCAL_URL = 'http://127.0.0.1:54321';
// service-role + anon keys are printed by `supabase start` / `supabase status`.
const SERVICE_ROLE = process.env.SUPABASE_LOCAL_SERVICE_ROLE_KEY;

// Only run when a local stack is configured; otherwise skip (keeps CI/unit runs fast).
const describeDb = SERVICE_ROLE ? describe : describe.skip;

describeDb('RidesService (real DB, RLS)', () => {
  const admin = createClient(LOCAL_URL, SERVICE_ROLE!, { auth: { persistSession: false } });

  beforeEach(async () => {
    // Reset only the tables this suite touches — fast and isolated.
    await admin.from('rides').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  afterAll(async () => {
    await admin.from('rides').delete().neq('id', '00000000-0000-0000-0000-000000000000');
  });

  it('a user cannot read another user\'s ride (RLS enforced)', async () => {
    // Arrange — insert a ride owned by user A via the admin (service-role bypasses RLS)
    await admin.from('rides').insert({ id: 'ride-a', user_id: 'user-a', title: 'A ride' });

    // Act — read as user B through a user-scoped (RLS-enforced) client
    const asUserB = createClient(LOCAL_URL, process.env.SUPABASE_LOCAL_ANON_KEY!, {
      global: { headers: { Authorization: `Bearer ${jwtFor('user-b')}` } },
      auth: { persistSession: false },
    });
    const { data } = await asUserB.from('rides').select('*').eq('id', 'ride-a');

    // Assert — RLS hides it
    expect(data).toEqual([]);
  });
});
```

Notes:
- Keep real-DB suites **opt-in via env** so the default `pnpm test` (unit) stays fast and
  hermetic. Run them locally / in a dedicated CI job that first does `pnpm db:start`.
- Reset per-test by deleting only the touched tables (fast, isolated) — don't `db:reset`
  between every test.
- `jwtFor(userId)` = mint a Supabase JWT for a seeded auth user (or seed real users via the
  admin auth API in `beforeAll`). Match however the auth guard validates tokens.

---

## What to mock vs. not

| Thing | Mock? |
|-------|-------|
| Injected `SupabaseClient` (Strategy A) | Yes — the clean chainable mock above |
| External APIs: Anthropic/Claude, NHTSA vPIC, RevenueCat, Mapbox, PostHog | Always mock |
| Sentry | Mock (`vi.mock('@sentry/nestjs', ...)`) |
| Pure mappers / Zod schemas / cursor & pagination logic | Never mock — call directly |
| Real Postgres + RLS (Strategy B) | Don't mock — use the local stack |
