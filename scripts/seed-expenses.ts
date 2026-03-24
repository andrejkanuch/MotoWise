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
  category: 'fuel' | 'maintenance' | 'parts' | 'gear';
  description: string;
  monthsAgo: number;
}

const EXPENSES: Expense[] = [
  // Gear
  { amount: 497.0, category: 'gear', description: 'Shoei NXR2 Nocturne TC-5 helmet', monthsAgo: 8 },
  { amount: 279.0, category: 'gear', description: 'Alpinestars GP Pro R4 gloves', monthsAgo: 7 },
  { amount: 449.99, category: 'gear', description: "Rev'it Ignition 4 H2O jacket", monthsAgo: 6 },
  { amount: 211.5, category: 'gear', description: 'Sidi Performer boots', monthsAgo: 5 },
  { amount: 656.99, category: 'gear', description: "Rev'it Valve H2O pants", monthsAgo: 4 },
  {
    amount: 69.0,
    category: 'gear',
    description: 'Dainese Manis D1 G2 back protector',
    monthsAgo: 3,
  },
  { amount: 319.95, category: 'gear', description: 'Cardo Packtalk Edge intercom', monthsAgo: 2 },
  {
    amount: 34.95,
    category: 'gear',
    description: 'Pinlock 70 Max Vision insert (Shoei NXR2)',
    monthsAgo: 1,
  },
  { amount: 89.0, category: 'gear', description: 'Held Cloudbreak rain suit', monthsAgo: 1 },
  // Maintenance
  {
    amount: 95.0,
    category: 'maintenance',
    description: 'Oil + filter change (Advantec 4L + HF filter)',
    monthsAgo: 7,
  },
  {
    amount: 350.0,
    category: 'maintenance',
    description: '10,000 km service (BMW dealer)',
    monthsAgo: 3,
  },
  { amount: 45.0, category: 'maintenance', description: 'Coolant flush', monthsAgo: 1 },
  // Parts
  { amount: 185.0, category: 'parts', description: 'Chain and sprocket kit', monthsAgo: 5 },
  {
    amount: 58.0,
    category: 'parts',
    description: 'Brake pads front (BMW OEM sintered)',
    monthsAgo: 4,
  },
  { amount: 32.0, category: 'parts', description: 'Air filter (Mahle/Mann boxer)', monthsAgo: 2 },
  // Fuel
  { amount: 62.0, category: 'fuel', description: 'Shell V-Power (~15L)', monthsAgo: 7 },
  { amount: 58.0, category: 'fuel', description: 'OMV MaxxMotion', monthsAgo: 6 },
  { amount: 71.0, category: 'fuel', description: 'Shell V-Power', monthsAgo: 5 },
  { amount: 65.0, category: 'fuel', description: 'Slovnaft fuel stop', monthsAgo: 4 },
  { amount: 59.0, category: 'fuel', description: 'OMV fuel', monthsAgo: 3 },
  { amount: 68.0, category: 'fuel', description: 'Shell V-Power', monthsAgo: 2 },
  { amount: 72.0, category: 'fuel', description: 'Shell V-Power (~16L)', monthsAgo: 1 },
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

  // Find BMW R 1250 GS (2023)
  const { data: bikes } = await supabase
    .from('motorcycles')
    .select('id, make, model, year')
    .eq('user_id', user.id)
    .is('deleted_at', null);

  const bmw = bikes?.find((b) => b.model?.includes('1250') && b.year === 2023);
  if (!bmw) {
    console.error('BMW R 1250 GS not found. Available:', bikes);
    process.exit(1);
  }
  console.log(`Bike: ${bmw.make} ${bmw.model} ${bmw.year} (${bmw.id})`);

  // Insert expenses
  const rows = EXPENSES.map((e) => ({
    user_id: user.id,
    motorcycle_id: bmw.id,
    amount: e.amount,
    category: e.category,
    description: e.description,
    date: dateMonthsAgo(e.monthsAgo),
  }));

  const { error: insertErr } = await supabase.from('expenses').insert(rows);
  if (insertErr) {
    console.error('Insert failed:', insertErr);
    process.exit(1);
  }

  // Summary
  const totals = { gear: 0, maintenance: 0, parts: 0, fuel: 0 };
  for (const r of rows) totals[r.category as keyof typeof totals] += r.amount;
  const grand = Object.values(totals).reduce((a, b) => a + b, 0);

  console.log(`\n✓ ${rows.length} expenses inserted`);
  console.log(`  Gear:        €${totals.gear.toFixed(2)}`);
  console.log(`  Maintenance: €${totals.maintenance.toFixed(2)}`);
  console.log(`  Parts:       €${totals.parts.toFixed(2)}`);
  console.log(`  Fuel:        €${totals.fuel.toFixed(2)}`);
  console.log(`  TOTAL:       €${grand.toFixed(2)}`);
  console.log(`  Gear %:      ${((totals.gear / grand) * 100).toFixed(1)}%`);
}

main().catch(console.error);
