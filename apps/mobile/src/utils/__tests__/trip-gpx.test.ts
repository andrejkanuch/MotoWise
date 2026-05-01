import { describe, expect, it } from '@jest/globals';
import { buildGpxFilename, buildTripGpx } from '../trip-gpx';

const baseMeta = {
  title: 'Alpine Pass Tour',
  description: 'A scenic ride through the Alps',
  createdAt: '2026-04-15T10:00:00Z',
};

const twoWaypoints = [
  { lat: 46.947, lng: 7.4474, name: 'Bern', notes: 'Starting point' },
  { lat: 46.0207, lng: 7.7491, name: 'Zermatt', notes: null },
];

describe('buildTripGpx', () => {
  it('generates valid GPX 1.1 XML with header and namespace', () => {
    const gpx = buildTripGpx(baseMeta, twoWaypoints);
    expect(gpx).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(gpx).toContain('<gpx version="1.1" creator="MotoVault"');
    expect(gpx).toContain('xmlns="http://www.topografix.com/GPX/1/1"');
  });

  it('includes metadata with title, description, and time', () => {
    const gpx = buildTripGpx(baseMeta, twoWaypoints);
    expect(gpx).toContain('<name>Alpine Pass Tour</name>');
    expect(gpx).toContain('<desc>A scenic ride through the Alps</desc>');
    expect(gpx).toContain('<time>2026-04-15T10:00:00Z</time>');
  });

  it('omits description tag in metadata when description is null', () => {
    const gpx = buildTripGpx({ ...baseMeta, description: null }, [
      { lat: 46.0207, lng: 7.7491, name: 'Zermatt', notes: null },
    ]);
    const metadataBlock = gpx.match(/<metadata>[\s\S]*?<\/metadata>/);
    expect(metadataBlock).toBeTruthy();
    expect(metadataBlock![0]).not.toContain('<desc>');
  });

  it('generates wpt elements for each waypoint', () => {
    const gpx = buildTripGpx(baseMeta, twoWaypoints);
    expect(gpx).toContain('<wpt lat="46.947" lon="7.4474">');
    expect(gpx).toContain('<wpt lat="46.0207" lon="7.7491">');
    expect(gpx).toContain('<name>Bern</name>');
    expect(gpx).toContain('<name>Zermatt</name>');
  });

  it('includes desc in wpt when notes are present', () => {
    const gpx = buildTripGpx(baseMeta, twoWaypoints);
    expect(gpx).toContain('<desc>Starting point</desc>');
  });

  it('omits desc in wpt when notes are null', () => {
    const gpx = buildTripGpx(baseMeta, [
      { lat: 46.0207, lng: 7.7491, name: 'Zermatt', notes: null },
    ]);
    // The Zermatt wpt should not have a <desc> child
    const wptMatch = gpx.match(/<wpt[^>]*>[\s\S]*?<\/wpt>/);
    expect(wptMatch).toBeTruthy();
    expect(wptMatch![0]).not.toContain('<desc>');
  });

  it('generates rte with rtept elements', () => {
    const gpx = buildTripGpx(baseMeta, twoWaypoints);
    expect(gpx).toContain('<rte>');
    expect(gpx).toContain('<rtept lat="46.947" lon="7.4474">');
    expect(gpx).toContain('<rtept lat="46.0207" lon="7.7491">');
    expect(gpx).toContain('</rte>');
  });

  it('escapes XML special characters in names and notes', () => {
    const gpx = buildTripGpx(
      { title: 'Tom & Jerry\'s <Ride>', description: null, createdAt: '2026-01-01T00:00:00Z' },
      [{ lat: 0, lng: 0, name: 'Stop "A" & B', notes: '<script>alert("xss")</script>' }],
    );
    expect(gpx).toContain('Tom &amp; Jerry&apos;s &lt;Ride&gt;');
    expect(gpx).toContain('Stop &quot;A&quot; &amp; B');
    expect(gpx).toContain('&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;');
  });

  it('handles empty waypoints array', () => {
    const gpx = buildTripGpx(baseMeta, []);
    expect(gpx).toContain('<rte>');
    expect(gpx).not.toContain('<wpt');
    expect(gpx).not.toContain('<rtept');
  });
});

describe('buildGpxFilename', () => {
  it('generates a kebab-case filename with motovault suffix', () => {
    expect(buildGpxFilename('Alpine Pass Tour')).toBe('alpine-pass-tour-motovault.gpx');
  });

  it('strips special characters', () => {
    expect(buildGpxFilename("Tom & Jerry's Ride!")).toBe('tom-jerry-s-ride-motovault.gpx');
  });

  it('trims leading/trailing hyphens', () => {
    expect(buildGpxFilename('---Test---')).toBe('test-motovault.gpx');
  });

  it('handles unicode titles', () => {
    const name = buildGpxFilename('Schwarzwald Straße 🏍️');
    expect(name).toContain('motovault.gpx');
    expect(name).not.toContain(' ');
  });
});
