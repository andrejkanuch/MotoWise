import {
  type ModelInsightsPayload,
  ModelInsightsPayloadSchema,
  ModelInsightsStatus,
} from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import {
  AI_INSIGHTS_PROVIDERS,
  type AiInsightsProvider,
  type ModelInsightsRequest,
} from './ai-provider.interface';

/** Result shape returned to the resolver. */
export interface ModelInsightsResult {
  status: ModelInsightsStatus;
  payload: ModelInsightsPayload | null;
}

const DEFAULT_TIMEOUT_MS = 2000;
/** Regenerate cached insights older than this (ms). */
const STALE_AFTER_MS = 1000 * 60 * 60 * 24 * 90; // 90 days

@Injectable()
export class ModelInsightsService {
  private readonly logger = new Logger(ModelInsightsService.name);
  private readonly timeoutMs: number;
  private readonly enabled: boolean;
  /** De-dupe concurrent generations for the same key within this instance. */
  private readonly generating = new Set<string>();

  constructor(
    @Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient,
    @Inject(AI_INSIGHTS_PROVIDERS) private readonly providers: AiInsightsProvider[],
    configService: ConfigService,
  ) {
    this.timeoutMs = Number(configService.get('AI_INSIGHTS_TIMEOUT_MS')) || DEFAULT_TIMEOUT_MS;
    // Kill switch — disabled forces the static provider only (no LLM spend).
    this.enabled = configService.get('AI_INSIGHTS_ENABLED') !== 'false';
  }

  private static normalizeKey(req: ModelInsightsRequest): string {
    return `${req.make.trim().toLowerCase()}|${req.model.trim().toLowerCase()}|${req.year}`;
  }

  /**
   * Cache-first read. On a hit returns the stored status/payload instantly. On
   * a miss, inserts a `pending` row and kicks off generation in the background
   * (fire-and-forget) — the caller gets `pending` immediately and the client
   * shows the static fallback / hides the AI card. Never blocks the Reveal.
   */
  async getInsights(req: ModelInsightsRequest): Promise<ModelInsightsResult> {
    const key = ModelInsightsService.normalizeKey(req);

    const { data: row } = await this.supabase
      .from('model_insights')
      .select('status, payload, generated_at')
      .eq('normalized_key', key)
      .maybeSingle();

    if (row) {
      const parsed = this.safeParse(row.payload);
      // Refresh stale ready rows in the background; serve the cached one now.
      if (row.status === ModelInsightsStatus.READY && this.isStale(row.generated_at)) {
        void this.generateInBackground(req, key);
      }
      // A previously-failed row: retry once in the background, serve nothing now.
      if (row.status === ModelInsightsStatus.FAILED) {
        void this.generateInBackground(req, key);
      }
      return {
        status: row.status as ModelInsightsStatus,
        payload: row.status === ModelInsightsStatus.READY ? parsed : null,
      };
    }

    // First sighting — enqueue (insert pending) and generate in the background.
    await this.supabase.from('model_insights').upsert(
      {
        normalized_key: key,
        year: req.year,
        make: req.make.trim(),
        model: req.model.trim(),
        status: ModelInsightsStatus.PENDING,
      },
      { onConflict: 'normalized_key', ignoreDuplicates: true },
    );
    void this.generateInBackground(req, key);
    return { status: ModelInsightsStatus.PENDING, payload: null };
  }

  private isStale(generatedAt: string | null): boolean {
    if (!generatedAt) return true;
    return Date.now() - new Date(generatedAt).getTime() > STALE_AFTER_MS;
  }

  private safeParse(payload: unknown): ModelInsightsPayload | null {
    if (!payload) return null;
    const result = ModelInsightsPayloadSchema.safeParse(payload);
    return result.success ? result.data : null;
  }

  /**
   * Run the failover chain (Gemini → OpenAI → static) and persist the result.
   * Each provider gets the tight per-call timeout; a throw, timeout, or
   * Zod-invalid payload falls through to the next. The static provider never
   * fails, so this always resolves to a `ready` row.
   */
  private async generateInBackground(req: ModelInsightsRequest, key: string): Promise<void> {
    if (this.generating.has(key)) return;
    this.generating.add(key);
    try {
      const chain = this.enabled
        ? this.providers
        : this.providers.filter((p) => p.name === 'static');

      for (const provider of chain) {
        if (!provider.isAvailable()) continue;
        try {
          const raw = await this.withTimeout(provider.generate(req, this.timeoutMs));
          const validated = this.validateAndTrim(raw);
          if (!validated) {
            this.logger.warn(`[${provider.name}] insights failed validation for ${key}`);
            continue;
          }
          await this.persist(key, validated, provider.name);
          return;
        } catch (err) {
          this.logger.warn(
            `[${provider.name}] insights generation failed for ${key}: ${(err as Error).message}`,
          );
        }
      }
      // Should be unreachable (static never fails), but record the dead-end.
      await this.markFailed(key);
    } finally {
      this.generating.delete(key);
    }
  }

  /** Enforce exactly-3 hedged bullets; reject otherwise so the chain continues. */
  private validateAndTrim(payload: ModelInsightsPayload): ModelInsightsPayload | null {
    const issues = payload.knownIssues?.filter((i) => i.title?.trim() && i.detail?.trim()) ?? [];
    if (issues.length < 3) return null;
    return { knownIssues: issues.slice(0, 3) };
  }

  private async withTimeout<T>(promise: Promise<T>): Promise<T> {
    let timer: ReturnType<typeof setTimeout> | undefined;
    const timeout = new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error('insights generation timed out')), this.timeoutMs);
    });
    try {
      return await Promise.race([promise, timeout]);
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  private async persist(key: string, payload: ModelInsightsPayload, source: string): Promise<void> {
    const { error } = await this.supabase
      .from('model_insights')
      .update({
        status: ModelInsightsStatus.READY,
        payload,
        source_model: source,
        generated_at: new Date().toISOString(),
      })
      .eq('normalized_key', key);
    if (error) this.logger.error(`Failed to persist insights for ${key}: ${error.message}`);
  }

  private async markFailed(key: string): Promise<void> {
    await this.supabase
      .from('model_insights')
      .update({ status: ModelInsightsStatus.FAILED, generated_at: new Date().toISOString() })
      .eq('normalized_key', key);
  }
}
