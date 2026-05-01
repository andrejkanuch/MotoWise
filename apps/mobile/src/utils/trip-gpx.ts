interface GpxWaypoint {
  lat: number;
  lng: number;
  name: string;
  notes?: string | null;
}

interface GpxTripMeta {
  title: string;
  description?: string | null;
  createdAt: string;
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generates a GPX 1.1 string from trip metadata and waypoints.
 * Includes both individual `<wpt>` elements and a `<rte>` for the full route.
 */
export function buildTripGpx(trip: GpxTripMeta, waypoints: GpxWaypoint[]): string {
  const wptElements = waypoints
    .map(
      (wp) =>
        `  <wpt lat="${wp.lat}" lon="${wp.lng}">\n    <name>${escapeXml(wp.name)}</name>${wp.notes ? `\n    <desc>${escapeXml(wp.notes)}</desc>` : ''}\n  </wpt>`,
    )
    .join('\n');

  const rteptElements = waypoints
    .map(
      (wp) =>
        `    <rtept lat="${wp.lat}" lon="${wp.lng}">\n      <name>${escapeXml(wp.name)}</name>${wp.notes ? `\n      <desc>${escapeXml(wp.notes)}</desc>` : ''}\n    </rtept>`,
    )
    .join('\n');

  return `<?xml version="1.0" encoding="UTF-8"?>
<gpx version="1.1" creator="MotoVault" xmlns="http://www.topografix.com/GPX/1/1">
  <metadata>
    <name>${escapeXml(trip.title)}</name>${trip.description ? `\n    <desc>${escapeXml(trip.description)}</desc>` : ''}
    <time>${trip.createdAt}</time>
  </metadata>
${wptElements}
  <rte>
    <name>${escapeXml(trip.title)}</name>
${rteptElements}
  </rte>
</gpx>`;
}

/**
 * Generates a slug-based filename for a trip GPX export.
 */
export function buildGpxFilename(title: string): string {
  const slug = title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `${slug}-motovault.gpx`;
}
