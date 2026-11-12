import { describe, expect, it } from 'vitest';
import { shouldCreateSpanForRequest } from '../sentry-span-filter';

describe('shouldCreateSpanForRequest', () => {
  it.each([
    'https://api.mapbox.com/styles/v1/mapbox/light-v11?access_token=pk.x',
    'https://api.mapbox.com/v4/mapbox.mapbox-streets-v8/8/231/93.vector.pbf?access_token=pk.x',
    'https://api.mapbox.com/fonts/v1/mapbox/DIN%20Pro%20Regular/0-255.pbf?access_token=pk.x',
    'https://events.mapbox.com/events/v2?access_token=pk.x',
    'https://API.MAPBOX.COM/map-sessions/v1',
  ])('drops Mapbox library request %s', (url) => {
    expect(shouldCreateSpanForRequest(url)).toBe(false);
  });

  it.each([
    'https://motovault.app/features?_rsc=abc',
    '/ingest/e/?ip=0',
    'https://api.motovault.app/graphql',
    'https://tpsoneenbrmdwvzcbifw.supabase.co/rest/v1/trips',
    'https://notmapbox.com/tiles',
    'https://mapbox.com.evil.example/tiles',
    'not a url',
  ])('keeps first-party or unknown request %s', (url) => {
    expect(shouldCreateSpanForRequest(url)).toBe(true);
  });
});
