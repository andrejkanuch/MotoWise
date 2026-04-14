/**
 * Seed GeoNames places taxonomy (countries, regions, cities).
 *
 * Downloads GeoNames data and upserts into the `places` table.
 * Only targets countries that already have seeded routes.
 *
 * Usage:
 *   SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... npx tsx scripts/seed-places.ts
 */

import { createReadStream } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import { createInterface } from 'node:readline';
import { createClient } from '@supabase/supabase-js';

/* ------------------------------------------------------------------ */
/*  Config                                                            */
/* ------------------------------------------------------------------ */

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY env vars.');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

const GEONAMES_BASE = 'https://download.geonames.org/export/dump';
const TMP_DIR = '/tmp/geonames-seed';
const BATCH_SIZE = 500;

/* ------------------------------------------------------------------ */
/*  Types                                                             */
/* ------------------------------------------------------------------ */

interface PlaceRow {
  id: number;
  kind: 'country' | 'region' | 'city';
  name: string;
  country_code: string;
  region_code: string | null;
  latitude: number;
  longitude: number;
  population: number;
}

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

async function downloadText(url: string): Promise<string> {
  console.log(`  Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.text();
}

async function downloadAndExtractZip(url: string, outPath: string): Promise<void> {
  console.log(`  Downloading ${url}...`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);

  const buffer = Buffer.from(await res.arrayBuffer());
  await mkdir(TMP_DIR, { recursive: true });
  const zipPath = `${TMP_DIR}/cities15000.zip`;
  await writeFile(zipPath, buffer);

  // Use unzip CLI (available on macOS/Linux)
  const { execSync } = await import('node:child_process');
  execSync(`unzip -o "${zipPath}" -d "${TMP_DIR}"`, { stdio: 'pipe' });
  console.log(`  Extracted to ${outPath}`);
}

function parseTsvLines(text: string, cb: (cols: string[]) => void): void {
  for (const line of text.split('\n')) {
    if (!line || line.startsWith('#')) continue;
    cb(line.split('\t'));
  }
}

async function parseTsvFile(filePath: string, cb: (cols: string[]) => void): Promise<void> {
  const rl = createInterface({
    input: createReadStream(filePath, 'utf-8'),
    crlfDelay: Number.POSITIVE_INFINITY,
  });
  for await (const line of rl) {
    if (!line || line.startsWith('#')) continue;
    cb(line.split('\t'));
  }
}

async function upsertBatch(rows: PlaceRow[]): Promise<void> {
  if (rows.length === 0) return;
  const { error } = await supabase
    .from('places')
    .upsert(rows, { onConflict: 'id', ignoreDuplicates: false });
  if (error) throw new Error(`Upsert failed: ${error.message}`);
}

async function flushRows(buffer: PlaceRow[], label: string): Promise<number> {
  let total = 0;
  for (let i = 0; i < buffer.length; i += BATCH_SIZE) {
    const batch = buffer.slice(i, i + BATCH_SIZE);
    await upsertBatch(batch);
    total += batch.length;
  }
  console.log(`  Upserted ${total} ${label}`);
  return total;
}

/* ------------------------------------------------------------------ */
/*  Fetch route countries                                             */
/* ------------------------------------------------------------------ */

async function getRouteCountryCodes(): Promise<Set<string>> {
  const { data, error } = await supabase
    .from('routes')
    .select('country_code')
    .not('country_code', 'is', null);

  if (error) throw new Error(`routes query failed: ${error.message}`);

  const codes = new Set<string>();
  for (const row of data ?? []) {
    if (row.country_code) codes.add(row.country_code);
  }

  console.log(`Found ${codes.size} countries with routes: ${[...codes].sort().join(', ')}`);
  return codes;
}

/* ------------------------------------------------------------------ */
/*  Parse & seed countries                                            */
/* ------------------------------------------------------------------ */

async function seedCountries(countryCodes: Set<string>): Promise<number> {
  console.log('\n--- Countries ---');
  const text = await downloadText(`${GEONAMES_BASE}/countryInfo.txt`);

  const rows: PlaceRow[] = [];
  parseTsvLines(text, (cols) => {
    // countryInfo.txt columns:
    // 0: ISO, 1: ISO3, 2: ISONum, 3: fips, 4: Country, 5: Capital,
    // 6: Area, 7: Population, 8: Continent, ...16: geonameId
    const iso = cols[0];
    if (!iso || !countryCodes.has(iso)) return;

    const geonameId = Number.parseInt(cols[16], 10);
    if (Number.isNaN(geonameId)) return;

    rows.push({
      id: geonameId,
      kind: 'country',
      name: cols[4],
      country_code: iso,
      region_code: null,
      latitude: 0,
      longitude: 0,
      population: Number.parseInt(cols[7], 10) || 0,
    });
  });

  return flushRows(rows, 'countries');
}

/* ------------------------------------------------------------------ */
/*  Parse & seed regions (admin1)                                     */
/* ------------------------------------------------------------------ */

async function seedRegions(countryCodes: Set<string>): Promise<number> {
  console.log('\n--- Regions (admin1) ---');
  const text = await downloadText(`${GEONAMES_BASE}/admin1CodesASCII.txt`);

  const rows: PlaceRow[] = [];
  parseTsvLines(text, (cols) => {
    // admin1CodesASCII.txt columns:
    // 0: code (CC.ADMIN1), 1: name, 2: nameAscii, 3: geonameId
    const code = cols[0];
    if (!code) return;

    const [cc] = code.split('.');
    if (!countryCodes.has(cc)) return;

    const geonameId = Number.parseInt(cols[3], 10);
    if (Number.isNaN(geonameId)) return;

    rows.push({
      id: geonameId,
      kind: 'region',
      name: cols[1],
      country_code: cc,
      region_code: code, // e.g. "US.CA"
      latitude: 0,
      longitude: 0,
      population: 0,
    });
  });

  return flushRows(rows, 'regions');
}

/* ------------------------------------------------------------------ */
/*  Parse & seed cities (>= 15,000 pop)                              */
/* ------------------------------------------------------------------ */

async function seedCities(countryCodes: Set<string>): Promise<number> {
  console.log('\n--- Cities (pop >= 15,000) ---');

  const zipUrl = `${GEONAMES_BASE}/cities15000.zip`;
  const txtPath = `${TMP_DIR}/cities15000.txt`;
  await downloadAndExtractZip(zipUrl, txtPath);

  const rows: PlaceRow[] = [];
  await parseTsvFile(txtPath, (cols) => {
    // cities15000.txt columns (standard GeoNames format):
    // 0: geonameId, 1: name, 2: asciiname, 3: alternatenames,
    // 4: latitude, 5: longitude, 6: feature class, 7: feature code,
    // 8: country code, 9: cc2, 10: admin1 code, ...14: population
    const cc = cols[8];
    if (!cc || !countryCodes.has(cc)) return;

    const geonameId = Number.parseInt(cols[0], 10);
    if (Number.isNaN(geonameId)) return;

    const population = Number.parseInt(cols[14], 10) || 0;
    if (population < 15000) return;

    const admin1 = cols[10];
    const regionCode = admin1 ? `${cc}.${admin1}` : null;

    rows.push({
      id: geonameId,
      kind: 'city',
      name: cols[1],
      country_code: cc,
      region_code: regionCode,
      latitude: Number.parseFloat(cols[4]),
      longitude: Number.parseFloat(cols[5]),
      population,
    });
  });

  return flushRows(rows, 'cities');
}

/* ------------------------------------------------------------------ */
/*  Main                                                              */
/* ------------------------------------------------------------------ */

async function main() {
  console.log('=== GeoNames Places Seed ===\n');

  const countryCodes = await getRouteCountryCodes();
  if (countryCodes.size === 0) {
    console.log('No routes found — nothing to seed.');
    return;
  }

  const countries = await seedCountries(countryCodes);
  const regions = await seedRegions(countryCodes);
  const cities = await seedCities(countryCodes);

  console.log('\n=== Summary ===');
  console.log(`  Countries: ${countries}`);
  console.log(`  Regions:   ${regions}`);
  console.log(`  Cities:    ${cities}`);
  console.log(`  Total:     ${countries + regions + cities}`);
  console.log('\nDone!');
}

main().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
