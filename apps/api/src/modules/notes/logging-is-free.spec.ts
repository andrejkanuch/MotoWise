/**
 * Logging is always free: notes and odometer readings are never behind Pro and
 * never count-limited. Three guards — what the modules import, what their source
 * reaches for, and what the services actually read for riders on every tier.
 */
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { AiBudgetModule } from '../ai-budget/ai-budget.module';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { EntitlementsService } from '../entitlements/entitlements.service';
import { OdometerModule } from '../odometer/odometer.module';
import { OdometerResolver } from '../odometer/odometer.resolver';
import { OdometerService } from '../odometer/odometer.service';
import type { NotePhotosLoader } from './note-photos.loader';
import { NotesModule } from './notes.module';
import { NotesResolver } from './notes.resolver';
import { NotesService } from './notes.service';

const MODULES_DIR = path.resolve(__dirname, '..');
const BIKE_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = 'note-1';
const NOTE_TEXT = 'Front tyre pressure that feels right loaded: 2.5 bar.';
const TIERS = ['anonymous', 'free', 'pro'] as const satisfies readonly AuthUser['tier'][];

const rider = (tier: AuthUser['tier']): AuthUser => ({
  id: 'user-1',
  email: 'rider@example.com',
  role: 'user',
  tier,
});

/** Tables that hold a rider's plan. Reading one would be a tier lookup. */
const PLAN_TABLES = ['users', 'subscriptions', 'entitlements', 'receipt_scan_usage', 'ai_usage'];

/** Modules that decide what a tier may do. */
const GATING_IMPORT = /from\s+['"][^'"]*(entitlements|ai-budget|revenuecat|subscription)[^'"]*['"]/;
/** Names that only exist to gate by tier or count. */
const GATING_IDENTIFIER =
  /\b(EntitlementsService|AiBudgetService|FREE_TIER_LIMITS|PRO_FEATURES|GATING_MATRIX|subscription_tier|subscription_status|\.tier\b|isPro|PaymentRequiredException)/;

function sourceFiles(moduleName: string): string[] {
  const walk = (dir: string): string[] =>
    readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(full);
      return entry.name.endsWith('.ts') && !entry.name.endsWith('.spec.ts') ? [full] : [];
    });
  return walk(path.join(MODULES_DIR, moduleName));
}

/** Source without comments — "no entitlement check" is written in two of them. */
function code(file: string): string {
  return readFileSync(file, 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*\/\/.*$/gm, '');
}

describe.each([
  ['notes', NotesModule, 9],
  ['odometer', OdometerModule, 6],
] as const)('%s module — no reach into the gating code', (name, moduleClass, minFiles) => {
  const files = sourceFiles(name);

  it('finds the module’s files (the check is not vacuous)', () => {
    expect(files.length).toBeGreaterThanOrEqual(minFiles);
    expect(files.map((file) => path.basename(file))).toEqual(
      expect.arrayContaining([`${name}.module.ts`, `${name}.resolver.ts`, `${name}.service.ts`]),
    );
  });

  it('does not import the entitlements or the AI-budget module', () => {
    const imports: unknown[] = Reflect.getMetadata('imports', moduleClass) ?? [];
    expect(imports).not.toContain(EntitlementsModule);
    expect(imports).not.toContain(AiBudgetModule);
  });

  it('does not provide the entitlements service itself', () => {
    const providers: unknown[] = Reflect.getMetadata('providers', moduleClass) ?? [];
    expect(providers).not.toContain(EntitlementsService);
  });

  it('no file imports from a gating module', () => {
    const offenders = files.filter((file) => GATING_IMPORT.test(code(file)));
    expect(offenders.map((file) => path.relative(MODULES_DIR, file))).toEqual([]);
  });

  it('no file reads a tier, a free-tier limit or an entitlement', () => {
    const offenders = files.filter((file) => GATING_IDENTIFIER.test(code(file)));
    expect(offenders.map((file) => path.relative(MODULES_DIR, file))).toEqual([]);
  });
});

describe('the patterns recognise a gate when there is one', () => {
  it.each([
    "import { EntitlementsService } from '../entitlements/entitlements.service';",
    "import { AiBudgetService } from '../ai-budget/ai-budget.service';",
  ])('import: %s', (line) => {
    expect(line).toMatch(GATING_IMPORT);
  });

  it.each([
    "if (user.tier !== 'pro') throw new ForbiddenException();",
    'if (count >= FREE_TIER_LIMITS.MAX_BIKES) return;',
    ".select('subscription_tier')",
    'constructor(private readonly entitlements: EntitlementsService) {}',
  ])('code: %s', (line) => {
    expect(line).toMatch(GATING_IDENTIFIER);
  });
});

/** Chainable, awaitable Supabase mock that records which tables and RPCs are used. */
function createSupabaseMock(result: { data: unknown; error: null }) {
  const chain: Record<string, unknown> = {};
  for (const method of [
    'select',
    'insert',
    'update',
    'delete',
    'eq',
    'in',
    'is',
    'gt',
    'order',
    'limit',
  ]) {
    chain[method] = () => chain;
  }
  chain.single = () => Promise.resolve(result);
  chain.maybeSingle = () => Promise.resolve(result);
  // biome-ignore lint/suspicious/noThenProperty: a PostgREST builder is a thenable
  chain.then = (resolve: (value: unknown) => unknown) => Promise.resolve(result).then(resolve);
  return {
    from: vi.fn((_table: string) => chain),
    rpc: vi.fn((_name: string, _args?: unknown) => Promise.resolve({ data: true, error: null })),
  };
}

const quiet = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
const tablesRead = (db: ReturnType<typeof createSupabaseMock>): string[] =>
  db.from.mock.calls.map(([table]) => table);

describe.each(TIERS)('notes for a rider on the "%s" tier', (tier) => {
  const noteRow = {
    id: NOTE_ID,
    user_id: 'user-1',
    motorcycle_id: BIKE_ID,
    body: NOTE_TEXT,
    odometer: 36400,
    linked_task_id: null,
    linked_expense_id: null,
    created_at: '2026-08-09T10:00:00Z',
    updated_at: '2026-08-09T10:00:00Z',
    linked_task: null,
    linked_expense: null,
  };
  let db: ReturnType<typeof createSupabaseMock>;
  let resolver: NotesResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createSupabaseMock({ data: noteRow, error: null });
    const service = new NotesService(
      db as never,
      createSupabaseMock({ data: null, error: null }) as never,
      { getOrThrow: () => 'https://example.supabase.co' } as never,
      { create: vi.fn().mockResolvedValue({ id: 'task-1' }) } as never,
    );
    Object.assign(service, { logger: quiet });
    resolver = new NotesResolver(service, { load: vi.fn() } as unknown as NotePhotosLoader);
  });

  it('creates, edits, turns into a task and deletes a note', async () => {
    const user = rider(tier);

    await expect(
      resolver.createNote(user, { motorcycleId: BIKE_ID, text: NOTE_TEXT, alsoCreateTask: true }),
    ).resolves.toMatchObject({ id: NOTE_ID, text: NOTE_TEXT });
    await expect(resolver.updateNote(user, NOTE_ID, { text: 'edited' })).resolves.toBeDefined();
    await expect(resolver.createTaskFromNote(user, NOTE_ID)).resolves.toBeDefined();
    await expect(resolver.deleteNote(user, NOTE_ID)).resolves.toBe(true);
  });

  it('never looks the rider’s plan up', async () => {
    const user = rider(tier);

    await resolver.createNote(user, { motorcycleId: BIKE_ID, text: NOTE_TEXT });
    await resolver.updateNote(user, NOTE_ID, { text: 'edited' });
    await resolver.deleteNote(user, NOTE_ID);

    expect(tablesRead(db).length).toBeGreaterThan(0);
    for (const table of tablesRead(db)) expect(PLAN_TABLES).not.toContain(table);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['soft_delete_note']);
  });
});

describe.each(TIERS)('odometer for a rider on the "%s" tier', (tier) => {
  let db: ReturnType<typeof createSupabaseMock>;
  let resolver: OdometerResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    db = createSupabaseMock({ data: [], error: null });
    const bike = { id: BIKE_ID, distanceUnit: 'km', currentMileage: 39407 };
    const service = new OdometerService(
      db as never,
      { findById: vi.fn().mockResolvedValue(bike) } as never,
    );
    Object.assign(service, { logger: quiet });
    resolver = new OdometerResolver(service);
  });

  it('logs a reading and reads the log back', async () => {
    const user = rider(tier);

    await expect(
      resolver.logOdometerReading(user, { motorcycleId: BIKE_ID, value: 39407 }),
    ).resolves.toMatchObject({ currentMileage: 39407 });
    await expect(resolver.odometerReadings(user, BIKE_ID, 20)).resolves.toEqual([]);
    await expect(resolver.pendingRideDistance(user, BIKE_ID)).resolves.toEqual({
      rideCount: 0,
      distance: 0,
    });
  });

  it('never looks the rider’s plan up', async () => {
    const user = rider(tier);

    await resolver.logOdometerReading(user, { motorcycleId: BIKE_ID, value: 39407 });
    await resolver.odometerReadings(user, BIKE_ID, 20);
    await resolver.pendingRideDistance(user, BIKE_ID);

    for (const table of tablesRead(db)) expect(PLAN_TABLES).not.toContain(table);
    expect([...new Set(tablesRead(db))].sort()).toEqual(['odometer_readings', 'rides']);
    expect(db.rpc.mock.calls.map(([name]) => name)).toEqual(['log_odometer_reading']);
  });
});
