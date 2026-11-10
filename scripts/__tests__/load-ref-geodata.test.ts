/**
 * load-ref-geodata and flag-synthetic-accounts.sql.
 *
 * The checksum and empty-table cases run everywhere, with no network and no database.
 * The database cases run only when REF_GEODATA_TEST_DATABASE_URL names a THROWAWAY
 * PostGIS database with the rider-insights schema applied, e.g. a container from
 * `postgis/postgis:17-3.5` prepared with supabase/checks/fixtures/rider-insights-schema.sql.
 * They truncate the reference tables and add then remove their own users and rides.
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { after, before, describe, test } from 'node:test';
import pg from 'pg';
import {
  checkKnownPoints,
  countReferenceRows,
  downloadVerified,
  type KnownPoint,
  loadReferenceData,
  type Queryable,
  type ReferenceData,
  sha256Hex,
  verifySha256,
} from '../load-ref-geodata';

const TEST_DB_ENV = 'REF_GEODATA_TEST_DATABASE_URL';
const ROOT = path.resolve(import.meta.dirname, '../..');

describe('checksums', () => {
  const bytes = new TextEncoder().encode('pinned file');
  const pinned = sha256Hex(bytes);

  test('a file whose SHA-256 differs from the pinned value is rejected', async () => {
    const tampered = new TextEncoder().encode('pinned file, edited');
    await assert.rejects(
      downloadVerified(
        'fixture',
        { url: 'https://example.invalid/a', sha256: pinned },
        async () => tampered,
      ),
      /fixture: checksum mismatch/,
    );
  });

  test('a file matching the pinned value is returned unchanged', async () => {
    const got = await downloadVerified(
      'fixture',
      { url: 'https://example.invalid/a', sha256: pinned },
      async () => bytes,
    );
    assert.equal(got.toString('utf8'), 'pinned file');
  });

  test('the pinned value is compared exactly', () => {
    assert.throws(() => verifySha256('fixture', bytes, pinned.toUpperCase()), /checksum mismatch/);
  });
});

describe('known-point check without data', () => {
  /** A database whose reference tables are empty: counts are 0, lookups find nothing. */
  const emptyDb: Queryable = {
    async query(text: string) {
      if (text.includes('AS border_parts')) {
        return {
          rows: [{ border_parts: '0', core_parts: '0', countries: '0', regions: '0', places: '0' }],
        } as never;
      }
      return { rows: [{ border: null, core: null, region: null }] } as never;
    },
  };

  test('fails, naming the empty tables and the unresolved point', async () => {
    await assert.rejects(checkKnownPoints(emptyDb), (err: Error) => {
      assert.match(err.message, /reference geodata check FAILED/);
      assert.match(err.message, /places: 0 rows/);
      assert.match(err.message, /border_parts: 0 rows/);
      assert.match(err.message, /central Bratislava: border parts give nothing, expected SK/);
      assert.match(
        err.message,
        /central Bratislava: region is nothing, expected Bratislava Region/,
      );
      return true;
    });
  });
});

describe('checks run inside the transaction', () => {
  const tiny: ReferenceData = {
    countries: [{ iso_a2: 'SK', name: 'Slovakia', geometry: '{}' }],
    regions: [{ iso_a2: 'SK', admin1_code: '02', name: 'Bratislava Region' }],
    places: [
      {
        geonameid: 1,
        name: 'Bratislava',
        iso_a2: 'SK',
        admin1_code: '02',
        population: 1,
        lat: 48.1,
        lng: 17.1,
      },
    ],
  };

  /** Records every statement; the known-point lookup answers `region`. */
  const fakeClient = (region: string) => {
    const log: string[] = [];
    const client = {
      async query(text: string) {
        log.push(text.trim().split(/\s+/)[0]);
        if (text.includes('AS border_parts')) {
          return {
            rows: [
              { border_parts: '1', core_parts: '1', countries: '1', regions: '1', places: '1' },
            ],
          };
        }
        if (text.includes('AS region')) return { rows: [{ border: ['SK'], core: ['SK'], region }] };
        return { rows: [] };
      },
    };
    return { client: client as unknown as pg.ClientBase, log };
  };

  test('a failing known-point check ROLLBACKs and never COMMITs', async () => {
    const { client, log } = fakeClient('Somewhere Else');
    await assert.rejects(loadReferenceData(client, tiny), /reference geodata check FAILED/);
    assert.ok(log.includes('ROLLBACK'));
    assert.ok(!log.includes('COMMIT'));
    assert.ok(!log.includes('ANALYZE'));
  });

  test('a passing check runs before COMMIT, and the counts come back', async () => {
    const { client, log } = fakeClient('Bratislava Region');
    const counts = await loadReferenceData(client, tiny);
    assert.equal(counts.places, 1);
    const lastInsert = log.lastIndexOf('INSERT');
    const check = log.indexOf('SELECT');
    assert.ok(lastInsert < check && check < log.indexOf('COMMIT'));
    assert.ok(log.indexOf('COMMIT') < log.indexOf('ANALYZE'));
  });
});

// ---------------------------------------------------------------------------
// Database cases
// ---------------------------------------------------------------------------

const databaseUrl = process.env[TEST_DB_ENV];
const skip = databaseUrl ? false : `${TEST_DB_ENV} not set`;

const square = (west: number, south: number, east: number, north: number) =>
  JSON.stringify({
    type: 'Polygon',
    coordinates: [
      [
        [west, south],
        [east, south],
        [east, north],
        [west, north],
        [west, south],
      ],
    ],
  });

/** Slovakia and Austria as boxes either side of 16.8 E; Bratislava inside the SK box. */
const FIXTURE: ReferenceData = {
  countries: [
    { iso_a2: 'SK', name: 'Slovakia', geometry: square(16.8, 47.7, 17.8, 48.6) },
    { iso_a2: 'AT', name: 'Austria', geometry: square(15.8, 47.7, 16.8, 48.6) },
  ],
  regions: [
    { iso_a2: 'SK', admin1_code: '02', name: 'Bratislava Region' },
    { iso_a2: 'AT', admin1_code: '09', name: 'Vienna' },
  ],
  places: [
    {
      geonameid: 3060972,
      name: 'Bratislava',
      iso_a2: 'SK',
      admin1_code: '02',
      population: 423737,
      lat: 48.14816,
      lng: 17.10674,
    },
    {
      geonameid: 2761369,
      name: 'Vienna',
      iso_a2: 'AT',
      admin1_code: '09',
      population: 1691468,
      lat: 48.20849,
      lng: 16.37208,
    },
  ],
};

describe('loading into a throwaway database', { skip }, () => {
  let client: pg.Client;

  before(async () => {
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
  });
  after(async () => {
    await client?.end();
  });

  test('a second run leaves identical counts', async () => {
    await loadReferenceData(client, FIXTURE);
    const first = await countReferenceRows(client);
    await loadReferenceData(client, FIXTURE);
    const second = await countReferenceRows(client);
    assert.deepEqual(second, first);
    assert.equal(first.countries, 2);
    assert.equal(first.regions, 2);
    assert.equal(first.places, 2);
    assert.ok(first.border_parts >= 2 && first.core_parts >= 2);
  });

  test('the known-point check passes on loaded data', async () => {
    await loadReferenceData(client, FIXTURE);
    await checkKnownPoints(client);
  });

  test('core parts are the country shrunk by 500 m: a point 200 m inside the border is border-only', async () => {
    await loadReferenceData(client, FIXTURE);
    // 200 m east of the SK/AT box edge at 16.8 E, at 48.1 N (1 degree of longitude is ~74.4 km there).
    const { rows } = await client.query<{ kind: string }>(
      `SELECT kind FROM public.ref_country_parts
       WHERE iso_a2 = 'SK' AND ST_Intersects(geom, ST_SetSRID(ST_MakePoint($1, 48.1), 4326))
       ORDER BY kind`,
      [16.8 + 200 / 74_400],
    );
    assert.deepEqual(
      rows.map((r) => r.kind),
      ['border'],
    );
  });

  test('a country with a far-off island part still shrinks its mainland by the full 500 m', async () => {
    // One SK feature with a second part 80 degrees east: shrinking both together would
    // run in world Mercator, where 500 m at 48 N is only ~335 m.
    const multi = JSON.stringify({
      type: 'MultiPolygon',
      coordinates: [
        JSON.parse(square(16.8, 47.7, 17.8, 48.6)).coordinates,
        JSON.parse(square(96, 70, 97, 70.5)).coordinates,
      ],
    });
    await loadReferenceData(client, {
      ...FIXTURE,
      countries: [{ iso_a2: 'SK', name: 'Slovakia', geometry: multi }, FIXTURE.countries[1]],
    });
    const { rows } = await client.query<{ kind: string }>(
      `SELECT kind FROM public.ref_country_parts
       WHERE iso_a2 = 'SK' AND ST_Intersects(geom, ST_SetSRID(ST_MakePoint($1, 48.1), 4326))
       ORDER BY kind`,
      [16.8 + 420 / 74_400],
    );
    assert.deepEqual(
      rows.map((r) => r.kind),
      ['border'],
    );
  });

  test('a load that fails part-way leaves the previous data in place', async () => {
    await loadReferenceData(client, FIXTURE);
    const before = await countReferenceRows(client);
    const broken: ReferenceData = {
      ...FIXTURE,
      places: [{ ...FIXTURE.places[0] }, { ...FIXTURE.places[0] }], // duplicate primary key
    };
    await assert.rejects(loadReferenceData(client, broken));
    assert.deepEqual(await countReferenceRows(client), before);
  });

  test('a load whose known-point check fails leaves the previous rows intact', async () => {
    await loadReferenceData(client, FIXTURE);
    const before = await countReferenceRows(client);
    const wrongPoint: KnownPoint = {
      label: 'Bratislava expected in Austria',
      lat: 48.1486,
      lng: 17.1077,
      iso_a2: 'AT',
      region: 'Vienna',
    };
    await assert.rejects(
      loadReferenceData(client, FIXTURE, [wrongPoint]),
      /reference geodata check FAILED/,
    );
    assert.deepEqual(await countReferenceRows(client), before);
  });

  test('the known-point check fails loudly on empty tables', async () => {
    await client.query('TRUNCATE public.ref_country_parts, public.ref_regions, public.ref_places');
    await assert.rejects(
      checkKnownPoints(client),
      /places: 0 rows[\s\S]*central Bratislava: border parts give nothing/,
    );
  });
});

describe('flag-synthetic-accounts.sql', { skip }, () => {
  const sqlPath = path.join(ROOT, 'scripts/flag-synthetic-accounts.sql');
  const GENERATED = '5a000000-0000-4000-8000-000000000001';
  const REAL = '5a000000-0000-4000-8000-000000000002';
  let client: pg.Client;

  before(async () => {
    client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    await client.query(
      `INSERT INTO auth.users (id, email) VALUES ($1, 'gen@example.test'), ($2, 'real@example.test')`,
      [GENERATED, REAL],
    );
    await client.query(
      `INSERT INTO public.users (id, email) VALUES ($1, 'gen@example.test'), ($2, 'real@example.test')`,
      [GENERATED, REAL],
    );
    // A generated ride (region, whole-second start, no waypoints) and a real one.
    await client.query(
      `INSERT INTO public.rides (user_id, status, started_at, ended_at, distance_m, region)
       VALUES ($1, 'completed', '2026-10-01 08:00:00+00', '2026-10-01 09:00:00+00', 70000, 'Alps'),
              ($2, 'completed', '2026-10-01 08:00:00.437+00', '2026-10-01 09:00:00+00', 20000, NULL)`,
      [GENERATED, REAL],
    );
  });
  after(async () => {
    await client.query('DELETE FROM auth.users WHERE id = ANY($1::uuid[])', [[GENERATED, REAL]]);
    await client.end();
  });

  const flagged = async () =>
    (
      await client.query<{ id: string }>(
        'SELECT id FROM public.users WHERE is_synthetic ORDER BY id',
      )
    ).rows.map((r) => r.id);

  test('as committed, with no ids pasted, it flags nobody', async () => {
    await client.query(readFileSync(sqlPath, 'utf8'));
    assert.deepEqual(await flagged(), []);
  });

  test('the review query lists the generated account and not the real rider', async () => {
    const results = (await client.query(
      readFileSync(sqlPath, 'utf8'),
    )) as unknown as pg.QueryResult[];
    const review = results[0].rows.map((r) => r.id);
    assert.deepEqual(review, [GENERATED]);
  });

  test('with an id pasted, it flags exactly that account', async () => {
    const sql = readFileSync(sqlPath, 'utf8').replace('-- confirmed ids go here', `'${GENERATED}'`);
    assert.notEqual(
      sql,
      readFileSync(sqlPath, 'utf8'),
      'the paste marker is missing from the file',
    );
    await client.query(sql);
    assert.deepEqual(await flagged(), [GENERATED]);
    await client.query('UPDATE public.users SET is_synthetic = false WHERE id = $1', [GENERATED]);
  });
});
