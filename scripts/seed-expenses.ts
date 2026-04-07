import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../apps/api/.env') });

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = createClient(url, key);

const USER_EMAIL = 'kanuchandrej@gmail.com';

interface Expense {
  amount: number;
  category:
    | 'fuel'
    | 'maintenance'
    | 'parts'
    | 'gear'
    | 'tires'
    | 'insurance'
    | 'registration'
    | 'tolls'
    | 'parking'
    | 'modifications'
    | 'training';
  description: string;
  monthsAgo: number;
  currency: string;
}

const EXPENSES: Expense[] = [
  // ── Services & Maintenance ──
  {
    amount: 85.0,
    category: 'maintenance',
    description: 'Annual oil + filter change (Advantec 5W-40 4L + OEM filter, DIY)',
    monthsAgo: 11,
    currency: 'EUR',
  },
  {
    amount: 22.0,
    category: 'maintenance',
    description: 'Final drive (bevel gear) oil change — SAE 75W90, DIY',
    monthsAgo: 11,
    currency: 'EUR',
  },
  {
    amount: 45.0,
    category: 'maintenance',
    description: 'Brake fluid flush (DOT 4, front + rear)',
    monthsAgo: 9,
    currency: 'EUR',
  },
  {
    amount: 340.0,
    category: 'maintenance',
    description: '10,000 km annual service (BMW dealer) — oil, filter, valve clearance',
    monthsAgo: 6,
    currency: 'EUR',
  },
  {
    amount: 15.0,
    category: 'maintenance',
    description: 'Coolant level check + top-up (BMW coolant concentrate)',
    monthsAgo: 3,
    currency: 'EUR',
  },
  {
    amount: 60.0,
    category: 'maintenance',
    description: 'Tire mounting + balancing (front + rear)',
    monthsAgo: 4,
    currency: 'EUR',
  },

  // ── Parts ──
  {
    amount: 45.0,
    category: 'parts',
    description: 'Front brake pads (EBC sintered Double-H)',
    monthsAgo: 8,
    currency: 'EUR',
  },
  {
    amount: 29.0,
    category: 'parts',
    description: 'Air filter (Mahle)',
    monthsAgo: 6,
    currency: 'EUR',
  },
  {
    amount: 24.0,
    category: 'parts',
    description: 'Spark plugs (NGK LMAR8AI-10) ×2',
    monthsAgo: 6,
    currency: 'EUR',
  },
  {
    amount: 114.38,
    category: 'parts',
    description: 'Michelin Anakee Adventure — Front 120/70R19',
    monthsAgo: 4,
    currency: 'EUR',
  },
  {
    amount: 140.22,
    category: 'parts',
    description: 'Michelin Anakee Adventure — Rear 170/60R17',
    monthsAgo: 4,
    currency: 'EUR',
  },

  // ── Fuel (R1250GS real-world: 5.0–5.3 L/100km, EU avg ~€1.70/L) ──
  {
    amount: 58.0,
    category: 'fuel',
    description: 'Fuel (~34L fill)',
    monthsAgo: 11,
    currency: 'EUR',
  },
  { amount: 62.0, category: 'fuel', description: 'Fuel', monthsAgo: 10, currency: 'EUR' },
  { amount: 55.0, category: 'fuel', description: 'Fuel', monthsAgo: 9, currency: 'EUR' },
  {
    amount: 68.0,
    category: 'fuel',
    description: 'Fuel (longer ride)',
    monthsAgo: 8,
    currency: 'EUR',
  },
  { amount: 59.0, category: 'fuel', description: 'Fuel', monthsAgo: 7, currency: 'EUR' },
  {
    amount: 71.0,
    category: 'fuel',
    description: 'Fuel (weekend trip)',
    monthsAgo: 6,
    currency: 'EUR',
  },
  { amount: 55.0, category: 'fuel', description: 'Fuel', monthsAgo: 5, currency: 'EUR' },
  { amount: 63.0, category: 'fuel', description: 'Fuel', monthsAgo: 4, currency: 'EUR' },
  { amount: 58.0, category: 'fuel', description: 'Fuel', monthsAgo: 3, currency: 'EUR' },
  { amount: 65.0, category: 'fuel', description: 'Fuel', monthsAgo: 2, currency: 'EUR' },
  { amount: 59.0, category: 'fuel', description: 'Fuel', monthsAgo: 1, currency: 'EUR' },

  // ── Gear ──
  {
    amount: 407.0,
    category: 'gear',
    description: 'Shoei NXR2 Black (Fortamoto)',
    monthsAgo: 10,
    currency: 'EUR',
  },
  {
    amount: 449.99,
    category: 'gear',
    description: "Rev'it Ignition 4 H2O jacket (Fortamoto)",
    monthsAgo: 8,
    currency: 'EUR',
  },
  {
    amount: 119.95,
    category: 'gear',
    description: 'Alpinestars SP-8 V3 gloves',
    monthsAgo: 7,
    currency: 'EUR',
  },
  {
    amount: 34.95,
    category: 'gear',
    description: 'Pinlock 70 Max Vision (Shoei NXR2)',
    monthsAgo: 2,
    currency: 'EUR',
  },

  // ── Accessories ──
  {
    amount: 336.16,
    category: 'gear',
    description: 'Cardo Packtalk Edge single (motointercom.eu)',
    monthsAgo: 5,
    currency: 'EUR',
  },

  // ── Tires ──
  {
    amount: 285.0,
    category: 'tires',
    description: 'Michelin Road 6 Front 120/70ZR17',
    monthsAgo: 5,
    currency: 'EUR',
  },
  {
    amount: 345.0,
    category: 'tires',
    description: 'Michelin Road 6 Rear 180/55ZR17',
    monthsAgo: 5,
    currency: 'EUR',
  },

  // ── Insurance ──
  {
    amount: 420.0,
    category: 'insurance',
    description: 'Annual liability insurance (Allianz)',
    monthsAgo: 10,
    currency: 'EUR',
  },

  // ── Registration ──
  {
    amount: 85.0,
    category: 'registration',
    description: 'Annual registration renewal + emissions check',
    monthsAgo: 9,
    currency: 'EUR',
  },

  // ── Tolls ──
  {
    amount: 12.5,
    category: 'tolls',
    description: 'Austrian highway vignette (10-day)',
    monthsAgo: 7,
    currency: 'EUR',
  },
  {
    amount: 8.0,
    category: 'tolls',
    description: 'Brenner motorway toll',
    monthsAgo: 6,
    currency: 'EUR',
  },

  // ── Parking ──
  {
    amount: 5.0,
    category: 'parking',
    description: 'Underground parking (Vienna old town)',
    monthsAgo: 7,
    currency: 'EUR',
  },
  {
    amount: 3.5,
    category: 'parking',
    description: 'City center parking meter',
    monthsAgo: 4,
    currency: 'EUR',
  },

  // ── Modifications ──
  {
    amount: 189.0,
    category: 'modifications',
    description: 'SW-Motech crash bars',
    monthsAgo: 8,
    currency: 'EUR',
  },
  {
    amount: 79.0,
    category: 'modifications',
    description: 'Puig touring windscreen',
    monthsAgo: 6,
    currency: 'EUR',
  },

  // ── Training ──
  {
    amount: 250.0,
    category: 'training',
    description: 'Advanced riding course (1 day)',
    monthsAgo: 3,
    currency: 'EUR',
  },
];

function dateMonthsAgo(months: number): string {
  const d = new Date();
  d.setMonth(d.getMonth() - months);
  // Random day 5-25 for natural spread
  d.setDate(5 + Math.floor(Math.random() * 20));
  return d.toISOString().split('T')[0];
}

async function main() {
  // Find user
  const { data: user, error: ue } = await supabase
    .from('users')
    .select('id')
    .eq('email', USER_EMAIL)
    .single();
  if (ue || !user) {
    console.error('User not found', ue);
    process.exit(1);
  }
  console.log('User:', user.id);

  // Find BMW R 1250 GS
  const { data: bikes } = await supabase
    .from('motorcycles')
    .select('id, make, model, year')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  const bmw = bikes?.find(
    (b) => b.make?.toLowerCase().includes('bmw') && b.model?.toLowerCase().includes('1250'),
  );
  if (!bmw) {
    console.error('BMW R 1250 GS not found. Available:', bikes);
    process.exit(1);
  }
  console.log(`Bike: ${bmw.make} ${bmw.model} ${bmw.year} (${bmw.id})`);

  // Delete existing expenses for this bike
  const { error: delErr, count } = await supabase
    .from('expenses')
    .delete({ count: 'exact' })
    .eq('user_id', user.id)
    .eq('motorcycle_id', bmw.id);
  if (delErr) {
    console.error('Delete failed:', delErr);
    process.exit(1);
  }
  console.log(`Deleted ${count ?? 0} old expenses`);

  // Insert new expenses
  const rows = EXPENSES.map((e) => ({
    user_id: user.id,
    motorcycle_id: bmw.id,
    amount: e.amount,
    category: e.category,
    description: e.description,
    date: dateMonthsAgo(e.monthsAgo),
    currency: e.currency,
  }));

  const { error: insertErr } = await supabase.from('expenses').insert(rows);
  if (insertErr) {
    console.error('Insert failed:', insertErr);
    process.exit(1);
  }

  // Summary
  const totals: Record<string, number> = {};
  for (const r of rows) totals[r.category] = (totals[r.category] ?? 0) + r.amount;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  console.log(`\n✓ ${rows.length} expenses inserted`);
  for (const [cat, amount] of Object.entries(totals).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${cat.padEnd(15)} €${amount.toFixed(2)}`);
  }
  console.log(`  ${'TOTAL'.padEnd(15)} €${grand.toFixed(2)}`);
}

main().catch(console.error);
