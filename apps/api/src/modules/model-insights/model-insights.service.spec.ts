import type { ModelInsightsPayload } from '@motovault/types';
import { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AiInsightsProvider, ModelInsightsRequest } from './ai-provider.interface';
import { ModelInsightsService } from './model-insights.service';

const VALID_PAYLOAD: ModelInsightsPayload = {
  knownIssues: [
    { title: 'Chain', detail: 'Owners commonly report checking chain tension.' },
    { title: 'Brakes', detail: 'It is often noted that brake pads wear over time.' },
    { title: 'Fluids', detail: 'Some riders mention staying ahead of oil changes.' },
  ],
};

const REQ: ModelInsightsRequest = { make: 'Honda', model: 'CB650R', year: 2021 };

/** Minimal Supabase stub: records the last update payload + returns a row on read. */
function createSupabaseStub(existingRow: Record<string, unknown> | null) {
  const updates: Record<string, unknown>[] = [];
  const upserts: Record<string, unknown>[] = [];
  const client = {
    from: () => ({
      select: () => ({
        eq: () => ({ maybeSingle: () => Promise.resolve({ data: existingRow, error: null }) }),
      }),
      upsert: (row: Record<string, unknown>) => {
        upserts.push(row);
        return Promise.resolve({ error: null });
      },
      update: (row: Record<string, unknown>) => {
        updates.push(row);
        return { eq: () => Promise.resolve({ error: null }) };
      },
    }),
  };
  return { client, updates, upserts };
}

function makeProvider(
  name: string,
  impl: (req: ModelInsightsRequest) => Promise<ModelInsightsPayload>,
  available = true,
): AiInsightsProvider {
  return { name, isAvailable: () => available, generate: impl };
}

function makeService(
  providers: AiInsightsProvider[],
  supabase: ReturnType<typeof createSupabaseStub>,
  env: Record<string, string> = {},
) {
  const config = {
    get: (key: string) => env[key],
  } as unknown as ConfigService;
  // biome-ignore lint/suspicious/noExplicitAny: test wiring of DI tokens
  return new ModelInsightsService(supabase.client as any, providers, config);
}

// Let background (fire-and-forget) generation settle.
const flush = () => new Promise((r) => setTimeout(r, 20));

describe('ModelInsightsService', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns cached ready payload instantly without calling providers', async () => {
    const provider = makeProvider('claude', vi.fn());
    const supabase = createSupabaseStub({
      status: 'ready',
      payload: VALID_PAYLOAD,
      generated_at: new Date().toISOString(),
    });
    const service = makeService([provider], supabase);

    const result = await service.getInsights(REQ);

    expect(result.status).toBe('ready');
    expect(result.payload).toEqual(VALID_PAYLOAD);
    expect(provider.generate).not.toHaveBeenCalled();
  });

  it('on cache miss returns pending and generates with the first available provider', async () => {
    const claude = makeProvider('claude', () => Promise.resolve(VALID_PAYLOAD));
    const supabase = createSupabaseStub(null);
    const service = makeService([claude, makeProvider('static', vi.fn())], supabase);

    const result = await service.getInsights(REQ);
    expect(result.status).toBe('pending');

    await flush();
    // Generation persisted a ready row from claude.
    const ready = supabase.updates.find((u) => u.status === 'ready');
    expect(ready).toBeDefined();
    expect(ready?.source_model).toBe('claude');
  });

  it('fails over to the next provider when the first throws', async () => {
    const claude = makeProvider('claude', () => Promise.reject(new Error('rate limited')));
    const openai = makeProvider('openai', () => Promise.resolve(VALID_PAYLOAD));
    const supabase = createSupabaseStub(null);
    const service = makeService([claude, openai], supabase);

    await service.getInsights(REQ);
    await flush();

    const ready = supabase.updates.find((u) => u.status === 'ready');
    expect(ready?.source_model).toBe('openai');
  });

  it('treats a payload with fewer than 3 issues as a failure and falls through', async () => {
    const tooFew: ModelInsightsPayload = { knownIssues: [VALID_PAYLOAD.knownIssues[0]] };
    const claude = makeProvider('claude', () => Promise.resolve(tooFew));
    const staticP = makeProvider('static', () => Promise.resolve(VALID_PAYLOAD));
    const supabase = createSupabaseStub(null);
    const service = makeService([claude, staticP], supabase);

    await service.getInsights(REQ);
    await flush();

    const ready = supabase.updates.find((u) => u.status === 'ready');
    expect(ready?.source_model).toBe('static');
  });

  it('skips unavailable providers', async () => {
    const claude = makeProvider('claude', vi.fn(), false); // unavailable
    const openai = makeProvider('openai', () => Promise.resolve(VALID_PAYLOAD));
    const supabase = createSupabaseStub(null);
    const service = makeService([claude, openai], supabase);

    await service.getInsights(REQ);
    await flush();

    expect(claude.generate).not.toHaveBeenCalled();
    expect(supabase.updates.find((u) => u.status === 'ready')?.source_model).toBe('openai');
  });

  it('times out a slow provider and falls through', async () => {
    const slow = makeProvider(
      'claude',
      () =>
        new Promise<ModelInsightsPayload>((resolve) =>
          setTimeout(() => resolve(VALID_PAYLOAD), 1000),
        ),
    );
    const fast = makeProvider('static', () => Promise.resolve(VALID_PAYLOAD));
    const supabase = createSupabaseStub(null);
    const service = makeService([slow, fast], supabase, { AI_INSIGHTS_TIMEOUT_MS: '30' });

    await service.getInsights(REQ);
    await flush();
    await new Promise((r) => setTimeout(r, 60));

    expect(supabase.updates.find((u) => u.status === 'ready')?.source_model).toBe('static');
  });

  it('when disabled, uses only the static provider', async () => {
    const claude = makeProvider('claude', vi.fn());
    const staticP = makeProvider('static', () => Promise.resolve(VALID_PAYLOAD));
    const supabase = createSupabaseStub(null);
    const service = makeService([claude, staticP], supabase, { AI_INSIGHTS_ENABLED: 'false' });

    await service.getInsights(REQ);
    await flush();

    expect(claude.generate).not.toHaveBeenCalled();
    expect(supabase.updates.find((u) => u.status === 'ready')?.source_model).toBe('static');
  });
});
