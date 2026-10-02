/**
 * Seeds the bike-detail redesign QA fixtures (features/bike-detail-shell-overview,
 * "Fixtures") into a LOCAL Supabase stack. Dev tooling only.
 *
 *   SUPABASE_URL=http://127.0.0.1:54321 SUPABASE_SERVICE_ROLE_KEY=<local key> \
 *     pnpm exec tsx scripts/seed-bike-hub-fixtures.ts --user <uuid> [--imperial-user <uuid>]
 *
 * --user          gets bike A "Africa Twin" (km, populated) and bike B "Ténéré 700" (empty).
 * --imperial-user gets bike C, a copy of A in miles. Its profile is set to imperial.
 *
 * Refuses to run unless SUPABASE_URL points at 127.0.0.1 / localhost. It reads
 * the environment only — never apps/api/.env, which points at production.
 *
 * Idempotent: every row has an id derived from (user id, label), and each run
 * deletes and re-creates exactly those rows.
 */
import { createHash } from 'node:crypto';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

const LOCAL_HOSTNAMES: ReadonlySet<string> = new Set(['127.0.0.1', 'localhost']);
const KM_PER_MILE = 1.609344;
const CURRENCY = 'EUR';

// Mirrors of @motovault/types constants. The workspace package is not resolvable
// at runtime from repo-root scripts, so the handful this script needs live here.
const MileageUnit = { MI: 'mi', KM: 'km' } as const;
const MeasurementSystem = { METRIC: 'metric', IMPERIAL: 'imperial' } as const;
/** SEEDED_CATEGORIES (constants/document-limits.ts) — what the API materialises on first vault use. */
const SEEDED_CATEGORIES = [
  { name: 'Insurance', promptsExpiry: true },
  { name: 'Registration', promptsExpiry: true },
  { name: 'Title/Ownership', promptsExpiry: false },
  { name: 'Inspection', promptsExpiry: true },
  { name: 'Service Records', promptsExpiry: false },
  { name: 'Manual', promptsExpiry: false },
  { name: 'Warranty', promptsExpiry: false },
  { name: 'Receipts', promptsExpiry: false },
] as const;

const ARG = { USER: '--user', IMPERIAL_USER: '--imperial-user' } as const;

type Unit = (typeof MileageUnit)[keyof typeof MileageUnit];

/** Deterministic UUID (v5-shaped) so re-runs address the same rows. */
function fixtureId(userId: string, label: string): string {
  const hex = createHash('sha1').update(`bike-hub-fixture:${userId}:${label}`).digest('hex');
  const variant = ((Number.parseInt(hex[16], 16) & 0x3) | 0x8).toString(16);
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-5${hex.slice(13, 16)}-${variant}${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

/** Fixture distances are written in km; the imperial copy shows the same bike in miles. */
const inUnit = (km: number, unit: Unit): number =>
  unit === MileageUnit.MI ? Math.round(km / KM_PER_MILE) : km;

function readArg(flag: string): string | undefined {
  const index = process.argv.indexOf(flag);
  return index === -1 ? undefined : process.argv[index + 1];
}

function localClient(): SupabaseClient {
  const url = process.env.SUPABASE_URL ?? '';
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
  let hostname = '';
  try {
    hostname = new URL(url).hostname;
  } catch {
    // handled by the check below
  }
  if (!LOCAL_HOSTNAMES.has(hostname)) {
    throw new Error(
      `Refusing to seed: SUPABASE_URL must be a 127.0.0.1 / localhost URL (got "${hostname || url}").`,
    );
  }
  if (!key) throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set.');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function run<T>(
  label: string,
  query: PromiseLike<{ data: T; error: { message: string } | null }>,
): Promise<T> {
  const { data, error } = await query;
  if (error) throw new Error(`${label}: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Fixture data. "Today" in the plan is 2026-10-02; dates are absolute.
// ---------------------------------------------------------------------------

const ODOMETER_KM = 38_167;
const LATEST_READING_AT = '2026-09-28T09:00:00Z';

const TASKS = [
  {
    label: 'brake-pads',
    title: 'Brake pads inspection',
    priority: 'high',
    dueDate: '2026-03-15',
    targetKm: 42_100,
  },
  { label: 'coolant', title: 'Coolant', priority: 'medium', dueDate: '2026-08-01' },
  { label: 'tire-pressure', title: 'Tire pressure', priority: 'low', dueDate: '2026-09-01' },
  { label: 'chain', title: 'Chain clean & lube', priority: 'low', dueDate: '2026-09-15' },
  {
    label: 'air-filter',
    title: 'Air filter',
    priority: 'medium',
    dueDate: '2026-10-04',
    targetKm: 46_900,
  },
  {
    label: 'second-service',
    title: '2nd scheduled service',
    priority: 'medium',
    completedAt: '2026-07-16T10:00:00Z',
    completedKm: 37_300,
  },
] as const;

/** 2026 = 1,960.62 (Oct 0, Sep 65.62, insurance 490.16 = 25 %); 2025 to Oct 2 = 1,748.62. */
const EXPENSES = [
  {
    label: 'ins-26',
    date: '2026-02-10',
    category: 'insurance',
    amount: 490.16,
    text: 'Mapfre annual premium',
  },
  {
    label: 'svc-26',
    date: '2026-07-16',
    category: 'maintenance',
    amount: 392.12,
    text: '2nd scheduled service',
  },
  { label: 'fuel-26-1', date: '2026-03-21', category: 'fuel', amount: 47.31, text: 'Fuel' },
  { label: 'fuel-26-2', date: '2026-05-09', category: 'fuel', amount: 47.32, text: 'Fuel' },
  { label: 'fuel-26-3', date: '2026-06-27', category: 'fuel', amount: 47.31, text: 'Fuel' },
  { label: 'fuel-26-4', date: '2026-08-14', category: 'fuel', amount: 47.32, text: 'Fuel' },
  { label: 'fuel-26-5', date: '2026-09-12', category: 'fuel', amount: 30.0, text: 'Fuel' },
  { label: 'fuel-26-6', date: '2026-09-27', category: 'fuel', amount: 35.62, text: 'Fuel' },
  {
    label: 'tires-26',
    date: '2026-04-18',
    category: 'tires',
    amount: 235.27,
    text: 'Rear tyre fitted',
  },
  {
    label: 'parts-26-1',
    date: '2026-05-30',
    category: 'parts',
    amount: 205.54,
    text: 'Chain and sprocket kit',
  },
  {
    label: 'parts-26-2',
    date: '2026-08-26',
    category: 'parts',
    amount: 29.73,
    text: 'Pattex Nural 50',
  },
  { label: 'gear-26', date: '2026-06-05', category: 'gear', amount: 200.0, text: 'Summer gloves' },
  {
    label: 'acc-26',
    date: '2026-07-02',
    category: 'accessories',
    amount: 152.92,
    text: 'Tank bag',
  },
  {
    label: 'ins-25',
    date: '2025-02-10',
    category: 'insurance',
    amount: 470.0,
    text: 'Mapfre annual premium',
  },
  {
    label: 'svc-25',
    date: '2025-04-20',
    category: 'maintenance',
    amount: 610.0,
    text: '1st scheduled service',
  },
  { label: 'fuel-25', date: '2025-06-15', category: 'fuel', amount: 318.62, text: 'Fuel' },
  {
    label: 'tires-25',
    date: '2025-07-30',
    category: 'tires',
    amount: 350.0,
    text: 'Front and rear tyres',
  },
  // After Oct 2 of 2025: must NOT count towards "same period of 2025".
  {
    label: 'gear-25-late',
    date: '2025-11-20',
    category: 'gear',
    amount: 120.0,
    text: 'Winter liner',
  },
] as const;

const NOTE_LINK = { EXPENSE: 'parts-26-2', TASK: 'second-service' } as const;

const NOTES = [
  {
    label: 'preload',
    at: '2026-09-28T17:30:00Z',
    km: 38_100,
    text: 'Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.',
  },
  {
    label: 'pattex',
    at: '2026-08-26T11:00:00Z',
    km: 37_950,
    text: 'Pattex Nural 50 held the cracked hand-guard mount. Keep the rest of the tube in the tool roll.',
    linkedExpense: NOTE_LINK.EXPENSE,
  },
  {
    label: 'pressure',
    at: '2026-08-09T08:15:00Z',
    km: 36_400,
    text: 'Front tyre pressure for loaded touring: 2.5 bar front, 2.9 bar rear, measured cold.',
  },
  {
    label: 'grips',
    at: '2026-07-20T19:00:00Z',
    text: 'Idea: heated grips before winter. Oxford or the Honda OEM kit?',
  },
  {
    label: 'dealer',
    at: '2026-07-16T15:45:00Z',
    km: 37_300,
    text: 'Dealer (Motos Ebro) flagged the rear pads at 40%. Ask for the DCT software update at the next visit.',
    linkedTask: NOTE_LINK.TASK,
  },
] as const;

const DOCUMENTS = [
  { label: 'insurance', category: 'Insurance', title: 'Mapfre', expiry: '2026-10-14' },
  { label: 'registration', category: 'Registration', title: 'Permiso de circulación' },
  { label: 'inspection', category: 'Inspection', title: 'ITV', expiry: '2027-05-20' },
  { label: 'manual', category: 'Manual', title: "Owner's manual" },
] as const;

/** Five rides already on the odometer, then four whose sync never applied (1,240 km / 1,240 mi). */
const APPLIED_RIDES = [
  { label: 'ride-1', day: '2026-06-06', km: 212 },
  { label: 'ride-2', day: '2026-07-04', km: 148 },
  { label: 'ride-3', day: '2026-08-08', km: 305 },
  { label: 'ride-4', day: '2026-08-22', km: 96 },
  { label: 'ride-5', day: '2026-09-19', km: 187 },
] as const;
const PENDING_RIDES = [
  { label: 'ride-6', day: '2026-09-29', share: 400 },
  { label: 'ride-7', day: '2026-09-30', share: 300 },
  { label: 'ride-8', day: '2026-10-01', share: 290 },
  { label: 'ride-9', day: '2026-10-01', share: 250, hour: 15 },
] as const;

const METERS_PER_UNIT: Record<Unit, number> = { km: 1000, mi: KM_PER_MILE * 1000 };

// ---------------------------------------------------------------------------

async function ensureCategories(
  supabase: SupabaseClient,
  userId: string,
): Promise<Map<string, string>> {
  await run(
    'seed document categories',
    supabase.from('document_categories').upsert(
      SEEDED_CATEGORIES.map((c) => ({
        user_id: userId,
        name: c.name,
        kind: 'seeded',
        prompts_expiry: c.promptsExpiry,
      })),
      { onConflict: 'user_id,name', ignoreDuplicates: true },
    ),
  );
  const rows = await run(
    'read document categories',
    supabase.from('document_categories').select('id, name').eq('user_id', userId),
  );
  return new Map((rows ?? []).map((row) => [row.name as string, row.id as string]));
}

async function seedPopulatedBike(supabase: SupabaseClient, userId: string, unit: Unit) {
  const id = (label: string) => fixtureId(userId, `${unit}:${label}`);
  const bikeId = id('africa-twin');
  const rideIds = [...APPLIED_RIDES, ...PENDING_RIDES].map((ride) => id(ride.label));

  // Cascades take tasks, expenses, documents, notes and readings with the bike.
  await run('clear rides', supabase.from('rides').delete().in('id', rideIds));
  await run('clear bike', supabase.from('motorcycles').delete().eq('id', bikeId));
  await run(
    'unset other primary bikes',
    supabase.from('motorcycles').update({ is_primary: false }).eq('user_id', userId),
  );

  await run(
    'insert bike',
    supabase.from('motorcycles').insert({
      id: bikeId,
      user_id: userId,
      make: 'Honda',
      model: 'Africa Twin',
      year: 2022,
      variant: 'DCT',
      is_primary: true,
      current_mileage: inUnit(ODOMETER_KM, unit),
      purchase_date: '2022-06-15',
      purchase_price: 11_800,
    }),
  );
  // The insert logged an 'initial' reading dated now; the fixture needs the last
  // reading on Sep 28 so the four later rides count as pending.
  await run(
    'clear readings',
    supabase.from('odometer_readings').delete().eq('motorcycle_id', bikeId),
  );
  await run(
    'insert readings',
    supabase.from('odometer_readings').insert([
      {
        user_id: userId,
        motorcycle_id: bikeId,
        value: inUnit(37_950, unit),
        recorded_at: '2026-08-26T10:00:00Z',
        source: 'manual',
      },
      {
        user_id: userId,
        motorcycle_id: bikeId,
        value: inUnit(ODOMETER_KM, unit),
        recorded_at: LATEST_READING_AT,
        source: 'manual',
      },
    ]),
  );
  await run(
    'stamp bike odometer date',
    supabase.from('motorcycles').update({ mileage_updated_at: LATEST_READING_AT }).eq('id', bikeId),
  );

  await run(
    'insert tasks',
    supabase.from('maintenance_tasks').insert(
      TASKS.map((task) => ({
        id: id(task.label),
        user_id: userId,
        motorcycle_id: bikeId,
        title: task.title,
        priority: task.priority,
        due_date: 'dueDate' in task ? task.dueDate : null,
        target_mileage: 'targetKm' in task ? inUnit(task.targetKm, unit) : null,
        status: 'completedAt' in task ? 'completed' : 'pending',
        completed_at: 'completedAt' in task ? task.completedAt : null,
        completed_mileage: 'completedKm' in task ? inUnit(task.completedKm, unit) : null,
      })),
    ),
  );

  await run(
    'insert expenses',
    supabase.from('expenses').insert(
      EXPENSES.map((expense) => ({
        id: id(expense.label),
        user_id: userId,
        motorcycle_id: bikeId,
        amount: expense.amount,
        category: expense.category,
        date: expense.date,
        description: expense.text,
        currency: CURRENCY,
      })),
    ),
  );

  await run(
    'insert notes',
    supabase.from('notes').insert(
      NOTES.map((note) => ({
        id: id(`note-${note.label}`),
        user_id: userId,
        motorcycle_id: bikeId,
        body: note.text,
        odometer: 'km' in note ? inUnit(note.km, unit) : null,
        linked_task_id: 'linkedTask' in note ? id(note.linkedTask) : null,
        linked_expense_id: 'linkedExpense' in note ? id(note.linkedExpense) : null,
        created_at: note.at,
        updated_at: note.at,
      })),
    ),
  );

  const categories = await ensureCategories(supabase, userId);
  await run(
    'insert documents',
    supabase.from('documents').insert(
      DOCUMENTS.map((document) => ({
        id: id(`doc-${document.label}`),
        user_id: userId,
        motorcycle_id: bikeId,
        category_id: categories.get(document.category),
        title: document.title,
        expiry_date: 'expiry' in document ? document.expiry : null,
      })),
    ),
  );

  const metersPerUnit = METERS_PER_UNIT[unit];
  const rideRow = (label: string, day: string, meters: number, applied: boolean, hour = 9) => ({
    id: id(label),
    user_id: userId,
    motorcycle_id: bikeId,
    started_at: `${day}T${String(hour).padStart(2, '0')}:00:00Z`,
    ended_at: `${day}T${String(hour + 4).padStart(2, '0')}:30:00Z`,
    status: 'completed',
    distance_m: meters,
    mileage_applied: applied,
  });
  await run(
    'insert rides',
    supabase.from('rides').insert([
      ...APPLIED_RIDES.map((ride) => rideRow(ride.label, ride.day, ride.km * 1000, true)),
      // 1,240 units in total, in the bike's own unit, so the chip reads "+1,240".
      ...PENDING_RIDES.map((ride) =>
        rideRow(
          ride.label,
          ride.day,
          Math.round(ride.share * metersPerUnit),
          false,
          'hour' in ride ? ride.hour : 9,
        ),
      ),
    ]),
  );
  return bikeId;
}

async function seedEmptyBike(supabase: SupabaseClient, userId: string) {
  const bikeId = fixtureId(userId, 'tenere-700');
  await run('clear empty bike', supabase.from('motorcycles').delete().eq('id', bikeId));
  await run(
    'insert empty bike',
    supabase.from('motorcycles').insert({
      id: bikeId,
      user_id: userId,
      make: 'Yamaha',
      model: 'Ténéré 700',
      year: 2024,
      is_primary: false,
      current_mileage: 1240,
      purchase_price: 10_400,
    }),
  );
  return bikeId;
}

async function setProfile(supabase: SupabaseClient, userId: string, system: string) {
  const rows = await run(
    'update profile',
    supabase
      .from('users')
      .update({ measurement_system: system, currency: CURRENCY })
      .eq('id', userId)
      .select('id'),
  );
  if (!rows || rows.length === 0) throw new Error(`No public.users row for ${userId}.`);
}

async function main() {
  const userId = readArg(ARG.USER);
  const imperialUserId = readArg(ARG.IMPERIAL_USER);
  if (!userId) {
    throw new Error(
      `Usage: seed-bike-hub-fixtures.ts ${ARG.USER} <uuid> [${ARG.IMPERIAL_USER} <uuid>]`,
    );
  }
  const supabase = localClient();

  // The profile unit goes first: the bike's distance_unit is taken from it on insert.
  await setProfile(supabase, userId, MeasurementSystem.METRIC);
  const bikeA = await seedPopulatedBike(supabase, userId, MileageUnit.KM);
  const bikeB = await seedEmptyBike(supabase, userId);
  console.log(`Bike A (Africa Twin, km): ${bikeA}`);
  console.log(`Bike B (Ténéré 700, empty): ${bikeB}`);

  if (imperialUserId) {
    await setProfile(supabase, imperialUserId, MeasurementSystem.IMPERIAL);
    const bikeC = await seedPopulatedBike(supabase, imperialUserId, MileageUnit.MI);
    console.log(`Bike C (Africa Twin, mi): ${bikeC}`);
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
