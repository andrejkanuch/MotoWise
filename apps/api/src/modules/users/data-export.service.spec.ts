import { beforeEach, describe, expect, it, vi } from 'vitest';
import { DataExportService } from './data-export.service';

const USER_ID = '11111111-1111-1111-1111-111111111111';
const FEEDBACK_ROW = { id: 'fb-1', user_id: USER_ID, message: 'Love it' };

/** Admin client fake: every table read resolves to rows keyed by table name. */
function createAdminClient(rowsByTable: Record<string, unknown[]>) {
  const uploads: Array<{ path: string; body: string }> = [];
  const from = vi.fn((table: string) => {
    const result = { data: rowsByTable[table] ?? [], error: null };
    const chain: Record<string, unknown> = {};
    for (const m of ['select', 'eq', 'or', 'limit', 'update']) chain[m] = () => chain;
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
  return { client: { from, storage }, uploads };
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
});
