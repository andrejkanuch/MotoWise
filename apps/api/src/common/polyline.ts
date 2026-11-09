/**
 * Google encoded polylines at 5-decimal precision, the format the mobile app
 * stores in `rides.route_polyline` and trips store in `polyline`.
 * https://developers.google.com/maps/documentation/utilities/polylinealgorithm
 */

export interface LatLng {
  lat: number;
  lng: number;
}

const PRECISION = 1e5;

function readValue(encoded: string, start: number): { value: number; next: number } {
  let result = 0;
  let shift = 0;
  let index = start;
  let byte: number;
  do {
    byte = encoded.charCodeAt(index++) - 63;
    result |= (byte & 0x1f) << shift;
    shift += 5;
  } while (byte >= 0x20);
  return { value: result & 1 ? ~(result >> 1) : result >> 1, next: index };
}

/** Decode an encoded polyline into points, in order. An empty string gives []. */
export function decodePolyline(encoded: string): LatLng[] {
  const points: LatLng[] = [];
  let index = 0;
  let lat = 0;
  let lng = 0;

  while (index < encoded.length) {
    const latStep = readValue(encoded, index);
    lat += latStep.value;
    const lngStep = readValue(encoded, latStep.next);
    lng += lngStep.value;
    index = lngStep.next;
    points.push({ lat: lat / PRECISION, lng: lng / PRECISION });
  }

  return points;
}

function encodeValue(value: number): string {
  let v = value < 0 ? ~(value << 1) : value << 1;
  let out = '';
  while (v >= 0x20) {
    out += String.fromCharCode((0x20 | (v & 0x1f)) + 63);
    v >>= 5;
  }
  return out + String.fromCharCode(v + 63);
}

/** Encode points as a polyline, rounding each coordinate to 5 decimals. */
export function encodePolyline(points: readonly LatLng[]): string {
  let out = '';
  let prevLat = 0;
  let prevLng = 0;
  for (const { lat, lng } of points) {
    const latE5 = Math.round(lat * PRECISION);
    const lngE5 = Math.round(lng * PRECISION);
    out += encodeValue(latE5 - prevLat) + encodeValue(lngE5 - prevLng);
    prevLat = latE5;
    prevLng = lngE5;
  }
  return out;
}
