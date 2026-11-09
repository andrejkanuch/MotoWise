import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataExportService } from './data-export.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const FEEDBACK_ROW = { id: 'fb-1', user_id: USER_ID, message: 'Love it' };

/** Admin client fake: every table read resolves to rows keyed by table name. */
function createAdminClient(rowsByTable: Record<string, unknown[]>) {
  const uploads: Array<{ path: string; body: string }> = [];
  const selects: Record<string, string> = {};
  const from = vi.fn((table: string) => {
    const result = { data: rowsByTable[table] ?? [], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['eq', 'or', 'limit', 'update']) chain[m] = () => chain;
    chain.select = (columns: string) => {
      selects[table] = columns;
      return chain;
    };
    chain.single = async () => ({ data: { id: USER_ID }, error: null });
    // biome-ignore lint/suspicious/noThenProperty: mimics a thenable PostgREST builder
    chain.then = (resolve: (v: unknown) => void) => resolve(result);
    return chain;
  });
  const storage = {
    from: () => ({
      upload: async (path: string, body: string) => {
        uploads.push({ path, body });
        return { error: null };
      },
      createSignedUrl: async () => ({ data: { signedUrl: 'https://signed' } }),
    }),
  };
  return { client: { from, storage }, uploads, selects };
}

describe('DataExportService export contents', () => {
  beforeEach(() => vi.clearAllMocks());

  it("includes the rider's feedback_messages rows", async () => {
    const admin = createAdminClient({ feedback_messages: [FEEDBACK_ROW] });
    const emailService = { sendDataExportReady: vi.fn().mockResolvedValue(undefined) };
    const service = new DataExportService(
      {} as never,
      admin.client as never,
      emailService as never,
    );

    await (
      service as unknown as {
        compileAndSendExport: (u: string, e: string, id: string) => Promise<void>;
      }
    ).compileAndSendExport(USER_ID, 'rider@example.com', 'export-1');

    expect(admin.uploads).toHaveLength(1);
    const exported = JSON.parse(admin.uploads[0].body);
    expect(exported.feedbackMessages).toEqual([FEEDBACK_ROW]);
  });

  it("includes the rider's ride_stats rows without cells, and routes as encoded polylines", async () => {
    const statsRow = { ride_id: 'ride-1', user_id: USER_ID, distance_m: 12_000, countries: ['ES'] };
    const trackRow = {
      ride_id: 'ride-1',
      source: 'waypoints',
      built_at: '2026-06-06T09:00:00Z',
      route: {
        type: 'LineString',
        coordinates: [
          [-120.2, 38.5],
          [-120.95, 40.7],
          [-126.453, 43.252],
        ],
      },
    };
    const admin = createAdminClient({ ride_stats: [statsRow], ride_tracks: [trackRow] });
    const service = new DataExportService(
      {} as never,
      admin.client as never,
      { sendDataExportReady: vi.fn().mockResolvedValue(undefined) } as never,
    );

    await (
      service as unknown as {
        compileAndSendExport: (u: string, e: string, id: string) => Promise<void>;
      }
    ).compileAndSendExport(USER_ID, 'rider@example.com', 'export-2');

    const exported = JSON.parse(admin.uploads[0].body);
    expect(exported.rideStats).toEqual([statsRow]);
    const statsColumns = admin.selects.ride_stats.split(',').map((c) => c.trim());
    expect(statsColumns).not.toContain('cells');
    expect(statsColumns).not.toContain('*');
    expect(statsColumns).toEqual(
      expect.arrayContaining(['ride_id', 'stops', 'countries', 'start_place']),
    );
    expect(exported.rideRoutes).toEqual([
      {
        ride_id: 'ride-1',
        source: 'waypoints',
        built_at: '2026-06-06T09:00:00Z',
        // Google's documented example polyline for these three points.
        route_polyline: '_p~iF~ps|U_ulLnnqC_mqNvxq`@',
      },
    ]);
  });
});
