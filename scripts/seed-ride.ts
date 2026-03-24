/**
 * Seed a complete ride with waypoints for testing charts.
 * Simulates a ~25km ride through hilly terrain with realistic speed/altitude changes.
 *
 * Usage: npx tsx scripts/seed-ride.ts
 */

import { resolve } from 'node:path';
import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';

dotenv.config({ path: resolve(__dirname, '../apps/api/.env') });

const url = process.env.SUPABASE_URL ?? '';
const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? '';
const supabase = createClient(url, key);

const USER_EMAIL = 'kanuchandrej@gmail.com';
const RIDE_NAME = 'Mountain Loop — Seed Ride';

// Simulated route: a loop ride with varied altitude and speed
// ~25km, ~35 minutes of riding through hilly terrain
// Base coordinates: near a mountainous area (Austrian Alps-ish)
const BASE_LAT = 47.27;
const BASE_LNG = 11.39;

interface WaypointSeed {
  lat: number;
  lng: number;
  altitude: number; // meters
  speedMps: number; // m/s
  heading: number; // degrees
}

function generateRouteWaypoints(): WaypointSeed[] {
  const points: WaypointSeed[] = [];
  const totalPoints = 200; // ~5s intervals over 35 min ≈ 420, but we'll simulate 200 key points

  for (let i = 0; i < totalPoints; i++) {
    const progress = i / totalPoints; // 0 to 1
    const angle = progress * 2 * Math.PI; // full loop

    // Create a loop route with some variation
    const radiusLat = 0.04; // ~4.4km
    const radiusLng = 0.06; // ~4.7km
    const wobble = Math.sin(angle * 3) * 0.005;

    const lat = BASE_LAT + Math.sin(angle) * radiusLat + wobble;
    const lng = BASE_LNG + Math.cos(angle) * radiusLng + Math.cos(angle * 2) * 0.01;

    // Altitude profile: climb in first half, descend in second half, with undulations
    const baseAltitude = 600; // starting elevation
    const climbProfile = Math.sin(angle) * 300; // main hill: 300m gain
    const undulation = Math.sin(angle * 5) * 40; // small rollers
    const altitude = baseAltitude + climbProfile + undulation;

    // Speed profile: slower uphill, faster downhill, with realistic variation
    const baseSpeed = 16; // ~58 km/h average
    const hillEffect = -Math.cos(angle) * 8; // slower uphill, faster downhill
    const speedVariation = Math.sin(angle * 7) * 3; // natural speed changes
    const cornerSlow = Math.abs(Math.sin(angle * 4)) > 0.9 ? -6 : 0; // slow in tight corners
    let speedMps = Math.max(2, baseSpeed + hillEffect + speedVariation + cornerSlow);

    // Add a brief stop (traffic light / fuel stop) around 40% of ride
    if (progress > 0.38 && progress < 0.42) {
      speedMps = progress > 0.39 && progress < 0.41 ? 0 : Math.min(speedMps, 5);
    }

    // Peak speed moment (~130 km/h on a straight)
    if (progress > 0.65 && progress < 0.7) {
      speedMps = 36 + Math.random() * 2; // ~130 km/h
    }

    // Heading: tangent to the loop
    const heading =
      ((Math.atan2(
        Math.cos(angle + 0.01) * radiusLng - Math.cos(angle) * radiusLng,
        Math.sin(angle + 0.01) * radiusLat - Math.sin(angle) * radiusLat,
      ) *
        180) /
        Math.PI +
        360) %
      360;

    points.push({
      lat,
      lng,
      altitude: Math.round(altitude * 10) / 10,
      speedMps: Math.round(speedMps * 100) / 100,
      heading: Math.round(heading * 10) / 10,
    });
  }

  return points;
}

// Encode route to Google polyline format
function encodePolyline(points: { lat: number; lng: number }[]): string {
  let encoded = '';
  let prevLat = 0;
  let prevLng = 0;

  for (const point of points) {
    const lat = Math.round(point.lat * 1e5);
    const lng = Math.round(point.lng * 1e5);

    encoded += encodeValue(lat - prevLat);
    encoded += encodeValue(lng - prevLng);

    prevLat = lat;
    prevLng = lng;
  }

  return encoded;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let encoded = '';

  while (v >= 0x20) {
    encoded += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  encoded += String.fromCharCode(v + 63);

  return encoded;
}

async function main() {
  console.log('Looking up user...');

  // Find the user
  const { data: user, error: userError } = await supabase
    .from('users')
    .select('id')
    .eq('email', USER_EMAIL)
    .single();

  if (userError || !user) {
    console.error(`User not found: ${USER_EMAIL}`, userError);
    process.exit(1);
  }

  console.log(`Found user: ${user.id}`);

  // Find a motorcycle for this user (optional)
  const { data: motorcycle } = await supabase
    .from('motorcycles')
    .select('id')
    .eq('user_id', user.id)
    .is('deleted_at', null)
    .limit(1)
    .single();

  const motorcycleId = motorcycle?.id ?? null;
  console.log(`Motorcycle: ${motorcycleId ?? 'none'}`);

  // Generate waypoints
  const waypointSeeds = generateRouteWaypoints();
  console.log(`Generated ${waypointSeeds.length} waypoints`);

  // Calculate ride stats from waypoints
  const startTime = new Date('2026-03-22T14:30:00Z');
  const intervalS = 10; // 10 seconds between waypoints
  const endTime = new Date(startTime.getTime() + waypointSeeds.length * intervalS * 1000);

  let totalDistance = 0;
  let maxSpeed = 0;
  let speedSum = 0;
  let speedCount = 0;
  let elevGain = 0;
  let elevLoss = 0;
  let prevAlt: number | null = null;

  for (let i = 1; i < waypointSeeds.length; i++) {
    const prev = waypointSeeds[i - 1];
    const curr = waypointSeeds[i];

    // Haversine distance
    const R = 6371000;
    const dLat = ((curr.lat - prev.lat) * Math.PI) / 180;
    const dLon = ((curr.lng - prev.lng) * Math.PI) / 180;
    const a =
      Math.sin(dLat / 2) ** 2 +
      Math.cos((prev.lat * Math.PI) / 180) *
        Math.cos((curr.lat * Math.PI) / 180) *
        Math.sin(dLon / 2) ** 2;
    totalDistance += R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    if (curr.speedMps > maxSpeed) maxSpeed = curr.speedMps;
    if (curr.speedMps > 0.5) {
      speedSum += curr.speedMps;
      speedCount++;
    }

    if (prevAlt !== null) {
      const diff = curr.altitude - prevAlt;
      if (diff > 0) elevGain += diff;
      else elevLoss += Math.abs(diff);
    }
    prevAlt = curr.altitude;
  }

  const avgSpeed = speedCount > 0 ? speedSum / speedCount : 0;
  const durationS = Math.round((endTime.getTime() - startTime.getTime()) / 1000);

  // Encode route polyline
  const polyline = encodePolyline(waypointSeeds.map((wp) => ({ lat: wp.lat, lng: wp.lng })));

  console.log(
    `Stats: ${Math.round(totalDistance)}m, max ${Math.round(maxSpeed * 3.6)}km/h, avg ${Math.round(avgSpeed * 3.6)}km/h`,
  );
  console.log(`Elevation: +${Math.round(elevGain)}m / -${Math.round(elevLoss)}m`);

  // Insert the ride
  const { data: ride, error: rideError } = await supabase
    .from('rides')
    .insert({
      user_id: user.id,
      motorcycle_id: motorcycleId,
      status: 'completed',
      name: RIDE_NAME,
      started_at: startTime.toISOString(),
      ended_at: endTime.toISOString(),
      distance_m: Math.round(totalDistance),
      max_speed_mps: Math.round(maxSpeed * 100) / 100,
      avg_speed_mps: Math.round(avgSpeed * 100) / 100,
      elevation_gain: Math.round(elevGain * 10) / 10,
      elevation_loss: Math.round(elevLoss * 10) / 10,
      route_polyline: polyline,
      gps_quality: 1,
      paused_duration_s: 0,
      auto_paused_duration_s: 20, // brief stop
    })
    .select('id')
    .single();

  if (rideError || !ride) {
    console.error('Failed to insert ride:', rideError);
    process.exit(1);
  }

  console.log(`Ride created: ${ride.id}`);

  // Insert waypoints in batches
  const waypointRows = waypointSeeds.map((wp, i) => ({
    ride_id: ride.id,
    recorded_at: new Date(startTime.getTime() + i * intervalS * 1000).toISOString(),
    latitude: wp.lat,
    longitude: wp.lng,
    altitude: wp.altitude,
    speed_mps: wp.speedMps,
    heading: wp.heading,
    accuracy: 3 + Math.random() * 5, // 3-8m accuracy
  }));

  // Supabase has a row limit per insert, batch by 100
  const batchSize = 100;
  for (let i = 0; i < waypointRows.length; i += batchSize) {
    const batch = waypointRows.slice(i, i + batchSize);
    const { error: wpError } = await supabase.from('ride_waypoints').insert(batch);
    if (wpError) {
      console.error(`Failed to insert waypoint batch ${i / batchSize + 1}:`, wpError);
      process.exit(1);
    }
    console.log(`Inserted waypoints ${i + 1}-${Math.min(i + batchSize, waypointRows.length)}`);
  }

  console.log('\nSeed complete!');
  console.log(`Ride: "${RIDE_NAME}"`);
  console.log(`  ID: ${ride.id}`);
  console.log(`  Distance: ${(totalDistance / 1000).toFixed(1)} km`);
  console.log(`  Duration: ${Math.round(durationS / 60)} min`);
  console.log(`  Max Speed: ${Math.round(maxSpeed * 3.6)} km/h`);
  console.log(`  Avg Speed: ${Math.round(avgSpeed * 3.6)} km/h`);
  console.log(`  Elevation: +${Math.round(elevGain)}m / -${Math.round(elevLoss)}m`);
  console.log(`  Waypoints: ${waypointRows.length}`);
}

main().catch(console.error);
