/**
 * Load the reference geodata that rider insights resolves places against:
 *
 *   ref_country_parts  Natural Earth admin-0 1:10m, keyed by ISO_A2_EH. Two kinds of rows:
 *                      `border` (the country as published, subdivided) and `core` (the
 *                      whole country shrunk 500 m inward on geography, THEN subdivided, so
 *                      subdivision seams never turn into gaps).
 *   ref_regions        GeoNames admin1CodesASCII: first-level area names.
 *   ref_places         GeoNames cities15000: towns for the start/end place and start region.
 *
 * Every source is a pinned URL with a pinned SHA-256; a file that does not match is
 * rejected before anything touches the database. All three tables are truncated and
 * reloaded in ONE transaction, so a failed run leaves the previous data in place and a
 * second run leaves the same row counts. Afterwards it prints the row counts and checks
 * known points (central Bratislava is SK and Bratislava Region). Both checks run inside
 * the transaction before COMMIT, so an empty or wrong result rolls back, keeps the previous
 * data and exits non-zero.
 *
 * Owner-run. The database URL comes ONLY from REF_GEODATA_DATABASE_URL; there is no
 * default. Use the direct (session) connection string with the postgres role, e.g.
 * `postgresql://postgres:<password>@db.<ref>.supabase.co:5432/postgres?sslmode=require`.
 *
 * Usage: REF_GEODATA_DATABASE_URL=... pnpm exec tsx scripts/load-ref-geodata.ts
 * Runbook: docs/runbooks/rider-insights-data.md
 */
import { createHash } from 'node:crypto';
import { pathToFileURL } from 'node:url';
import { inflateRawSync } from 'node:zlib';
import pg from 'pg';

export const DATABASE_URL_ENV = 'REF_GEODATA_DATABASE_URL' as const;

export interface PinnedSource {
  url: string;
  sha256: string;
}

/**
 * GeoNames publishes its dumps under fixed names and rewrites them daily, so the GeoNames
 * files are pinned through Internet Archive snapshots (`id_` serves the original bytes).
 * To move to newer data, pick a newer snapshot, download it, and replace URL and hash.
 */
export const SOURCES = {
  countries: {
    url: 'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/v5.1.2/geojson/ne_10m_admin_0_countries.geojson',
    sha256: '239eec57ac17f100a11e2536cffc56752c318b50ae765b0918ff7aab4ce8f255',
  },
  regions: {
    url: 'https://web.archive.org/web/20260919094037id_/https://download.geonames.org/export/dump/admin1CodesASCII.txt',
    sha256: '590651498043f674accda2b7f46d21286cda0e290b02f8561c5005eee9a5448c',
  },
  places: {
    url: 'https://web.archive.org/web/20261023163723id_/https://download.geonames.org/export/dump/cities15000.zip',
    sha256: '6d9ec0783783fd382b632dc120a9e1d401020ac98552fc74d05f40e56ea719b2',
  },
} as const satisfies Record<string, PinnedSource>;

const PLACES_ZIP_ENTRY = 'cities15000.txt';
/** Natural Earth's code for "no ISO code" (disputed areas, bases, reefs). */
const NO_ISO_CODE = '-99';
/** How far a country is shrunk for its core parts, in metres. */
export const CORE_SHRINK_M = 500;
/** Max vertices per subdivided polygon. */
const SUBDIVIDE_MAX_VERTICES = 256;
const INSERT_BATCH = 5_000;
/** Same radius the stats compute uses for the nearest town. */
const NEAREST_PLACE_M = 25_000;

export interface CountryRow {
  iso_a2: string;
  name: string;
  /** GeoJSON geometry, as text. */
  geometry: string;
}

export interface RegionRow {
  iso_a2: string;
  admin1_code: string;
  name: string;
}

export interface PlaceRow {
  geonameid: number;
  name: string;
  iso_a2: string;
  admin1_code: string | null;
  population: number | null;
  lat: number;
  lng: number;
}

export interface ReferenceData {
  countries: CountryRow[];
  regions: RegionRow[];
  places: PlaceRow[];
}

export interface ReferenceCounts {
  border_parts: number;
  core_parts: number;
  countries: number;
  regions: number;
  places: number;
}

/** The subset of a pg client this script uses, so checks can run on a fake. */
export interface Queryable {
  query<R extends pg.QueryResultRow = pg.QueryResultRow>(
    text: string,
    values?: unknown[],
  ): Promise<{ rows: R[] }>;
}

// ---------------------------------------------------------------------------
// Download and checksum
// ---------------------------------------------------------------------------

export function sha256Hex(data: Uint8Array): string {
  return createHash('sha256').update(data).digest('hex');
}

export function verifySha256(label: string, data: Uint8Array, expected: string): void {
  const actual = sha256Hex(data);
  if (actual !== expected) {
    throw new Error(
      `${label}: checksum mismatch (expected ${expected}, got ${actual}). Refusing to load an unpinned file.`,
    );
  }
}

export type Fetcher = (url: string) => Promise<Uint8Array>;

const fetchBytes: Fetcher = async (url) => {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`GET ${url} failed: HTTP ${res.status}`);
  return new Uint8Array(await res.arrayBuffer());
};

export async function downloadVerified(
  label: string,
  source: PinnedSource,
  fetcher: Fetcher = fetchBytes,
): Promise<Buffer> {
  const data = await fetcher(source.url);
  verifySha256(label, data, source.sha256);
  return Buffer.from(data);
}

// ---------------------------------------------------------------------------
// Parsing
// ---------------------------------------------------------------------------

/** One entry of a zip archive (stored or deflated). Enough for the GeoNames dumps. */
export function readZipEntry(zip: Buffer, entryName: string): Buffer {
  const EOCD_SIG = 0x06054b50;
  const CEN_SIG = 0x02014b50;
  const LOC_SIG = 0x04034b50;
  let eocd = -1;
  for (let i = zip.length - 22; i >= 0; i--) {
    if (zip.readUInt32LE(i) === EOCD_SIG) {
      eocd = i;
      break;
    }
  }
  if (eocd < 0) throw new Error('not a zip archive');
  const entries = zip.readUInt16LE(eocd + 10);
  let p = zip.readUInt32LE(eocd + 16);
  for (let n = 0; n < entries; n++) {
    if (zip.readUInt32LE(p) !== CEN_SIG) throw new Error('corrupt zip central directory');
    const method = zip.readUInt16LE(p + 10);
    const compressedSize = zip.readUInt32LE(p + 20);
    const nameLen = zip.readUInt16LE(p + 28);
    const extraLen = zip.readUInt16LE(p + 30);
    const commentLen = zip.readUInt16LE(p + 32);
    const localOffset = zip.readUInt32LE(p + 42);
    const name = zip.toString('utf8', p + 46, p + 46 + nameLen);
    if (name === entryName) {
      if (zip.readUInt32LE(localOffset) !== LOC_SIG) throw new Error('corrupt zip local header');
      const start =
        localOffset + 30 + zip.readUInt16LE(localOffset + 26) + zip.readUInt16LE(localOffset + 28);
      const raw = zip.subarray(start, start + compressedSize);
      if (method === 0) return Buffer.from(raw);
      if (method === 8) return inflateRawSync(raw);
      throw new Error(`zip entry ${entryName}: unsupported compression method ${method}`);
    }
    p += 46 + nameLen + extraLen + commentLen;
  }
  throw new Error(`zip entry ${entryName} not found`);
}

interface NeFeature {
  properties: { ISO_A2_EH?: string; NAME?: string };
  geometry: unknown;
}

export function parseCountries(geojson: string): CountryRow[] {
  const doc = JSON.parse(geojson) as { features?: NeFeature[] };
  if (!Array.isArray(doc.features)) throw new Error('countries: not a GeoJSON FeatureCollection');
  return doc.features
    .filter((f) => f.geometry && f.properties.ISO_A2_EH && f.properties.ISO_A2_EH !== NO_ISO_CODE)
    .map((f) => ({
      iso_a2: f.properties.ISO_A2_EH as string,
      name: f.properties.NAME ?? (f.properties.ISO_A2_EH as string),
      geometry: JSON.stringify(f.geometry),
    }));
}

/** admin1CodesASCII.txt: `CC.code<TAB>name<TAB>asciiname<TAB>geonameid`. */
export function parseRegions(text: string): RegionRow[] {
  const rows: RegionRow[] = [];
  for (const line of text.split('\n')) {
    const [key, name] = line.split('\t');
    if (!key || !name) continue;
    const dot = key.indexOf('.');
    if (dot < 1) continue;
    rows.push({ iso_a2: key.slice(0, dot), admin1_code: key.slice(dot + 1), name });
  }
  return rows;
}

/** GeoNames geoname table columns used here (0-based). */
const GN = { id: 0, name: 1, lat: 4, lng: 5, country: 8, admin1: 10, population: 14 } as const;

export function parsePlaces(text: string): PlaceRow[] {
  const rows: PlaceRow[] = [];
  for (const line of text.split('\n')) {
    const c = line.split('\t');
    if (c.length < 15) continue;
    const population = Number.parseInt(c[GN.population], 10);
    rows.push({
      geonameid: Number.parseInt(c[GN.id], 10),
      name: c[GN.name],
      iso_a2: c[GN.country],
      admin1_code: c[GN.admin1] || null,
      population: Number.isFinite(population) ? population : null,
      lat: Number.parseFloat(c[GN.lat]),
      lng: Number.parseFloat(c[GN.lng]),
    });
  }
  return rows;
}

// ---------------------------------------------------------------------------
// Load (one transaction)
// ---------------------------------------------------------------------------

function batches<T>(items: readonly T[], size: number): T[][] {
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Truncate and reload all three tables in one transaction, then run the row-count and
 * known-point checks on the same client BEFORE committing: a load that fails them rolls
 * back and the previous data stays live. Returns the committed row counts. Countries are staged
 * whole, unioned per ISO code (Natural Earth splits e.g. Kazakhstan and Baikonur),
 * and only then subdivided or shrunk-then-subdivided.
 */
export async function loadReferenceData(
  client: pg.ClientBase,
  data: ReferenceData,
  points: readonly KnownPoint[] = KNOWN_POINTS,
): Promise<ReferenceCounts> {
  if (data.countries.length === 0 || data.regions.length === 0 || data.places.length === 0) {
    throw new Error('refusing to load: a source parsed to zero rows');
  }
  let counts: ReferenceCounts;
  await client.query('BEGIN');
  try {
    // Buffering whole countries on geography is slow; the session role may carry a timeout.
    await client.query(`SET LOCAL statement_timeout = 0`);
    await client.query(
      `CREATE TEMP TABLE stage_countries (iso_a2 text NOT NULL, name text NOT NULL, geom geometry NOT NULL) ON COMMIT DROP`,
    );
    for (const country of data.countries) {
      await client.query(
        `INSERT INTO stage_countries (iso_a2, name, geom)
         VALUES ($1, $2, ST_MakeValid(ST_SetSRID(ST_GeomFromGeoJSON($3), 4326)))`,
        [country.iso_a2, country.name, country.geometry],
      );
    }
    await client.query(
      `CREATE TEMP TABLE stage_country_union ON COMMIT DROP AS
       SELECT iso_a2,
              (array_agg(name ORDER BY ST_Area(geom) DESC))[1] AS name,
              ST_CollectionExtract(ST_MakeValid(ST_Union(geom)), 3) AS geom
       FROM stage_countries
       GROUP BY iso_a2`,
    );

    await client.query(
      'TRUNCATE public.ref_country_parts, public.ref_regions, public.ref_places RESTART IDENTITY',
    );

    // Border parts: the country as published, split into polygons, then subdivided.
    await client.query(
      `INSERT INTO public.ref_country_parts (iso_a2, name, kind, geom)
       SELECT c.iso_a2, c.name, 'border', piece.geom
       FROM stage_country_union c
       CROSS JOIN LATERAL ST_Subdivide(c.geom, $1) AS sub(geom)
       CROSS JOIN LATERAL ST_Dump(sub.geom) AS piece
       WHERE ST_GeometryType(piece.geom) = 'ST_Polygon' AND NOT ST_IsEmpty(piece.geom)`,
      [SUBDIVIDE_MAX_VERTICES],
    );

    // Core parts: the whole country shrunk inward first, repaired, empties dropped, and
    // only then subdivided. The shrink runs per disjoint landmass (mainland, each island,
    // each overseas part), which gives the same shape as shrinking them together, since
    // they share no edge. It matters because a geography buffer works in a projection
    // PostGIS picks from the input's extent: France with French Guiana, or Norway with
    // Svalbard, gets world Mercator, where 500 m shrinks only 500 m x cos(latitude).
    await client.query(
      `INSERT INTO public.ref_country_parts (iso_a2, name, kind, geom)
       SELECT s.iso_a2, s.name, 'core', piece.geom
       FROM (
         SELECT c.iso_a2, c.name,
                ST_CollectionExtract(
                  ST_MakeValid(ST_SetSRID(ST_Buffer(land.geom::geography, $2)::geometry, 4326)), 3
                ) AS geom
         FROM stage_country_union c
         CROSS JOIN LATERAL ST_Dump(c.geom) AS land
       ) s
       CROSS JOIN LATERAL ST_Subdivide(s.geom, $1) AS sub(geom)
       CROSS JOIN LATERAL ST_Dump(sub.geom) AS piece
       WHERE NOT ST_IsEmpty(s.geom)
         AND ST_GeometryType(piece.geom) = 'ST_Polygon' AND NOT ST_IsEmpty(piece.geom)`,
      [SUBDIVIDE_MAX_VERTICES, -CORE_SHRINK_M],
    );

    for (const batch of batches(data.regions, INSERT_BATCH)) {
      await client.query(
        `INSERT INTO public.ref_regions (iso_a2, admin1_code, name)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[])`,
        [batch.map((r) => r.iso_a2), batch.map((r) => r.admin1_code), batch.map((r) => r.name)],
      );
    }

    for (const batch of batches(data.places, INSERT_BATCH)) {
      await client.query(
        `INSERT INTO public.ref_places (geonameid, name, iso_a2, admin1_code, population, geom)
         SELECT id, name, iso, admin1, pop, ST_SetSRID(ST_MakePoint(lng, lat), 4326)
         FROM unnest($1::int[], $2::text[], $3::text[], $4::text[], $5::int[], $6::float8[], $7::float8[])
           AS t(id, name, iso, admin1, pop, lat, lng)`,
        [
          batch.map((p) => p.geonameid),
          batch.map((p) => p.name),
          batch.map((p) => p.iso_a2),
          batch.map((p) => p.admin1_code),
          batch.map((p) => p.population),
          batch.map((p) => p.lat),
          batch.map((p) => p.lng),
        ],
      );
    }

    counts = await countReferenceRows(client);
    await checkKnownPoints(client, points);
    await client.query('COMMIT');
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  }
  await client.query('ANALYZE public.ref_country_parts, public.ref_regions, public.ref_places');
  return counts;
}

// ---------------------------------------------------------------------------
// Counts and known-point checks
// ---------------------------------------------------------------------------

export async function countReferenceRows(db: Queryable): Promise<ReferenceCounts> {
  const { rows } = await db.query<Record<keyof ReferenceCounts, string>>(
    `SELECT
       (SELECT count(*) FROM public.ref_country_parts WHERE kind = 'border') AS border_parts,
       (SELECT count(*) FROM public.ref_country_parts WHERE kind = 'core') AS core_parts,
       (SELECT count(DISTINCT iso_a2) FROM public.ref_country_parts) AS countries,
       (SELECT count(*) FROM public.ref_regions) AS regions,
       (SELECT count(*) FROM public.ref_places) AS places`,
  );
  const row = rows[0];
  if (!row) throw new Error('row count query returned nothing');
  return {
    border_parts: Number(row.border_parts),
    core_parts: Number(row.core_parts),
    countries: Number(row.countries),
    regions: Number(row.regions),
    places: Number(row.places),
  };
}

export interface KnownPoint {
  label: string;
  lat: number;
  lng: number;
  iso_a2: string;
  region: string;
}

export const KNOWN_POINTS: readonly KnownPoint[] = [
  {
    label: 'central Bratislava',
    lat: 48.1486,
    lng: 17.1077,
    iso_a2: 'SK',
    region: 'Bratislava Region',
  },
];

/**
 * Throws, listing every failure, unless each table has rows and each known point
 * lies in its country's border AND core parts and its nearest town (within 25 km)
 * sits in the expected region.
 */
export async function checkKnownPoints(
  db: Queryable,
  points: readonly KnownPoint[] = KNOWN_POINTS,
): Promise<void> {
  const failures: string[] = [];
  const counts = await countReferenceRows(db);
  for (const [table, n] of Object.entries(counts)) {
    if (!(n > 0)) failures.push(`${table}: 0 rows`);
  }

  for (const point of points) {
    const { rows } = await db.query<{
      border: string[] | null;
      core: string[] | null;
      region: string | null;
    }>(
      `WITH pt AS (SELECT ST_SetSRID(ST_MakePoint($2, $1), 4326) AS g)
       SELECT
         (SELECT array_agg(DISTINCT p.iso_a2) FROM public.ref_country_parts p, pt
            WHERE p.kind = 'border' AND ST_Intersects(p.geom, pt.g)) AS border,
         (SELECT array_agg(DISTINCT p.iso_a2) FROM public.ref_country_parts p, pt
            WHERE p.kind = 'core' AND ST_Intersects(p.geom, pt.g)) AS core,
         (SELECT r.name FROM public.ref_places pl
            JOIN public.ref_regions r ON r.iso_a2 = pl.iso_a2 AND r.admin1_code = pl.admin1_code,
            pt
            WHERE ST_DWithin(pl.geom::geography, pt.g::geography, $3)
            ORDER BY ST_Distance(pl.geom::geography, pt.g::geography), pl.geonameid
            LIMIT 1) AS region`,
      [point.lat, point.lng, NEAREST_PLACE_M],
    );
    const row = rows[0];
    const show = (v: string[] | string | null | undefined) =>
      v === null || v === undefined ? 'nothing' : Array.isArray(v) ? v.join(',') : v;
    const one = (v: string[] | null | undefined) => (v?.length === 1 ? v[0] : null);
    if (one(row?.border) !== point.iso_a2) {
      failures.push(
        `${point.label}: border parts give ${show(row?.border)}, expected ${point.iso_a2}`,
      );
    }
    if (one(row?.core) !== point.iso_a2) {
      failures.push(`${point.label}: core parts give ${show(row?.core)}, expected ${point.iso_a2}`);
    }
    if (row?.region !== point.region) {
      failures.push(`${point.label}: region is ${show(row?.region)}, expected ${point.region}`);
    }
  }

  if (failures.length > 0) {
    throw new Error(`reference geodata check FAILED:\n  - ${failures.join('\n  - ')}`);
  }
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export async function fetchReferenceData(fetcher?: Fetcher): Promise<ReferenceData> {
  const [countries, regions, places] = await Promise.all([
    downloadVerified('Natural Earth admin-0', SOURCES.countries, fetcher),
    downloadVerified('GeoNames admin1', SOURCES.regions, fetcher),
    downloadVerified('GeoNames cities15000', SOURCES.places, fetcher),
  ]);
  return {
    countries: parseCountries(countries.toString('utf8')),
    regions: parseRegions(regions.toString('utf8')),
    places: parsePlaces(readZipEntry(places, PLACES_ZIP_ENTRY).toString('utf8')),
  };
}

async function main(): Promise<void> {
  const databaseUrl = process.env[DATABASE_URL_ENV];
  if (!databaseUrl) {
    console.error(`✗ ${DATABASE_URL_ENV} is not set. There is no default database.`);
    process.exit(1);
  }

  console.log('Downloading pinned sources and verifying checksums…');
  const data = await fetchReferenceData();
  console.log(
    `  parsed ${data.countries.length} country features, ${data.regions.length} regions, ${data.places.length} places`,
  );

  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    console.log('Loading (one transaction: truncate + reload)…');
    const started = Date.now();
    const counts = await loadReferenceData(client, data);
    console.log(`  done in ${Math.round((Date.now() - started) / 1000)} s`);

    console.log('Row counts:');
    console.table(counts);

    for (const p of KNOWN_POINTS) {
      console.log(`✓ ${p.label} (${p.lat}, ${p.lng}) → ${p.iso_a2}, ${p.region}`);
    }
  } finally {
    await client.end();
  }
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main().catch((err: unknown) => {
    console.error(`✗ ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  });
}
