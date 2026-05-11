/**
 * Backfill elevation_profile JSONB on trip templates.
 *
 * Decodes stored Google polyline → lat/lng pairs → samples at ~200m intervals
 * → queries Mapbox Tilequery API for elevation at each sample point
 * → stores as Array<{distanceKm, elevationM, lat, lng}> in trips.elevation_profile.
 *
 * Idempotent: skips trips where elevation_profile IS NOT NULL.
 * Re-runnable: failures are logged and skipped, not fatal.
 *
 * Usage: npx tsx scripts/backfill-elevation-profiles.ts
 * Requires: SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, MAPBOX_ACCESS_TOKEN in .env
 */
import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../apps/api/.env') });

const SUPABASE_URL = process.env.SUPABASE_URL ?? '';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const MAPBOX_TOKEN = process.env.MAPBOX_ACCESS_TOKEN ?? '';
const SAMPLE_INTERVAL_M = 200; // sample every ~200m
const BATCH_SIZE = 5; // concurrent Mapbox requests per trip

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}
if (!MAPBOX_TOKEN) {
  console.error('Missing MAPBOX_ACCESS_TOKEN — needed for elevation queries');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

interface ElevationPoint {
  distanceKm: number;
  elevationM: number;
  lat: number;
  lng: number;
}

function decodePolyline(encoded: string): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    let shift = 0;
    let result = 0;
    let byte: number;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lat += result & 1 ? ~(result >> 1) : result >> 1;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    lng += result & 1 ? ~(result >> 1) : result >> 1;

    points.push([lat / 1e5, lng / 1e5]);
  }
  return points;
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/**
 * Sample polyline points at ~SAMPLE_INTERVAL_M intervals.
 * Returns sampled points with cumulative distance in km.
 */
function samplePolyline(
  points: Array<[number, number]>,
): Array<{ lat: number; lng: number; distanceKm: number }> {
  if (points.length === 0) return [];

  const sampled: Array<{ lat: number; lng: number; distanceKm: number }> = [
    { lat: points[0][0], lng: points[0][1], distanceKm: 0 },
  ];

  let cumulativeM = 0;
  let lastSampledM = 0;

  for (let i = 1; i < points.length; i++) {
    const dist = haversineM(points[i - 1][0], points[i - 1][1], points[i][0], points[i][1]);
    cumulativeM += dist;

    if (cumulativeM - lastSampledM >= SAMPLE_INTERVAL_M) {
      sampled.push({
        lat: points[i][0],
        lng: points[i][1],
        distanceKm: cumulativeM / 1000,
      });
      lastSampledM = cumulativeM;
    }
  }

  // Always include the last point
  const lastPoint = points[points.length - 1];
  const lastSampled = sampled[sampled.length - 1];
  if (lastSampled.lat !== lastPoint[0] || lastSampled.lng !== lastPoint[1]) {
    sampled.push({
      lat: lastPoint[0],
      lng: lastPoint[1],
      distanceKm: cumulativeM / 1000,
    });
  }

  return sampled;
}

/**
 * Query Mapbox Tilequery API for elevation at given coordinates.
 * Uses mapbox.mapbox-terrain-v2 tileset.
 */
async function getElevation(lat: number, lng: number): Promise<number | null> {
  const url = `https://api.mapbox.com/v4/mapbox.mapbox-terrain-v2/tilequery/${lng},${lat}.json?layers=contour&limit=1&access_token=${MAPBOX_TOKEN}`;

  try {
    const res = await fetch(url);
    if (!res.ok) return null;

    const data = (await res.json()) as {
      features?: Array<{ properties?: { ele?: number } }>;
    };
    return data.features?.[0]?.properties?.ele ?? null;
  } catch {
    return null;
  }
}

/**
 * Get elevation for a batch of points with rate limiting.
 */
async function getElevationsForPoints(
  points: Array<{ lat: number; lng: number; distanceKm: number }>,
): Promise<ElevationPoint[]> {
  const results: ElevationPoint[] = [];

  // Process in batches to respect rate limits
  for (let i = 0; i < points.length; i += BATCH_SIZE) {
    const batch = points.slice(i, i + BATCH_SIZE);
    const elevations = await Promise.all(batch.map((p) => getElevation(p.lat, p.lng)));

    for (let j = 0; j < batch.length; j++) {
      results.push({
        distanceKm: batch[j].distanceKm,
        elevationM: elevations[j] ?? 0,
        lat: batch[j].lat,
        lng: batch[j].lng,
      });
    }

    // Small delay between batches to avoid rate limiting
    if (i + BATCH_SIZE < points.length) {
      await new Promise((r) => setTimeout(r, 100));
    }
  }

  return results;
}

async function main() {
  console.log('Fetching trip templates without elevation profiles...');

  const { data: trips, error } = await supabase
    .from('trips')
    .select('id, title, polyline')
    .eq('is_template', true)
    .is('elevation_profile', null)
    .not('polyline', 'is', null);

  if (error) {
    console.error('Failed to fetch trips:', error.message);
    process.exit(1);
  }

  console.log(`Found ${trips?.length ?? 0} trips to backfill`);

  let success = 0;
  let failed = 0;

  for (const trip of trips ?? []) {
    try {
      console.log(`Processing: ${trip.title ?? trip.id}`);

      const points = decodePolyline(trip.polyline);
      if (points.length === 0) {
        console.warn(`  Skipped: empty polyline`);
        failed++;
        continue;
      }

      const sampled = samplePolyline(points);
      console.log(`  Decoded ${points.length} points → ${sampled.length} samples`);

      const profile = await getElevationsForPoints(sampled);

      const { error: updateError } = await supabase
        .from('trips')
        .update({ elevation_profile: profile })
        .eq('id', trip.id);

      if (updateError) {
        console.error(`  Failed to update: ${updateError.message}`);
        failed++;
        continue;
      }

      console.log(
        `  Done (${profile.length} points, ${profile[profile.length - 1]?.distanceKm?.toFixed(1) ?? 0} km)`,
      );
      success++;
    } catch (err) {
      console.error(`  Error processing ${trip.id}:`, err);
      failed++;
    }
  }

  console.log(`\nBackfill complete: ${success} succeeded, ${failed} failed`);

  // Verification
  const { count: backfilled } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('is_template', true)
    .not('elevation_profile', 'is', null);

  const { count: missing } = await supabase
    .from('trips')
    .select('id', { count: 'exact', head: true })
    .eq('is_template', true)
    .is('elevation_profile', null)
    .not('polyline', 'is', null);

  console.log(`Verification: ${backfilled ?? 0} backfilled, ${missing ?? 0} still missing`);
}

main().catch(console.error);
