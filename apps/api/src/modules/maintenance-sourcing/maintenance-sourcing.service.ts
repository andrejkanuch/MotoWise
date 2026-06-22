/**
 * Maintenance-sourcing extraction service (plan U2).
 *
 * DEVELOPER-RUN FLOW — this is NOT a user-facing GraphQL endpoint. It is the persistence half
 * of the owner's-manual extraction pipeline: a developer/operator runs the (out-of-scope this
 * session) PDF-ingestion + OpenAI extraction step, which produces Zod-validated
 * `ExtractedScheduleDraft[]` / `ExtractedSpecDraft[]`, then hands them here to be persisted as
 * DRAFT rows (`is_verified=false`) for the human verification gate (U4) to approve.
 *
 * U2 PRE-FLIGHT (run BEFORE extracting — plan U2 "Approach"):
 *   1. Confirm the owner's manual actually CONTAINS each targeted spec_type. Torque /
 *      valve-clearance depth is frequently service-manual-only (service manuals are deferred).
 *      If the owner's manual lacks a spec_type, narrow the pilot scope honestly — do NOT
 *      persist empty/guessed rows.
 *   2. Record the source's `market_applicability` (the es-edition's market) and note the
 *      working assumption that es-edition values apply to the EN/US-facing article.
 *   3. Capture a page number AND a context snippet for EVERY value (intake vs exhaust,
 *      hot vs cold, DCT vs MT) so U4's reviewer can confirm the value is for the right spec.
 *
 * SAFETY-CRITICAL CLASSIFICATION (plan KTD 8 — the central rule of this unit):
 *   `is_safety_critical` is computed SERVER-SIDE from `isSafetyCriticalName()` (the
 *   `SAFETY_CRITICAL_ALLOWLIST` in @motovault/types), NEVER from model output. This deliberately
 *   does NOT replicate `article-generator.service.ts:233`, which derives `is_safety_critical`
 *   from LLM-output keyword matching — that trusts the model and is the opposite of the rule here.
 *
 * FACTS ONLY (R2): we store extracted VALUES + page reference + a short context snippet. We never
 * copy manual prose, procedures, diagrams, or the manual's table selection/arrangement.
 *
 * UPSERT-vs-DEDUP DECISION (plan KTD U2 "Idempotent insert"):
 *   The natural-key unique indexes in migration 00149 are COALESCE-EXPRESSION indexes
 *   (`UNIQUE (make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), ...)`).
 *   PostgREST/supabase-js `.upsert(..., { onConflict })` only accepts a comma-separated COLUMN
 *   list and resolves it to a constraint/index over those bare columns — it cannot target an
 *   expression index. Passing `onConflict: 'make,model,variant,...'` would NOT match the
 *   expression index and the upsert would fail (or fall back to a plain insert and violate the
 *   index). So per the plan's explicit fallback, we do SELECT-then-INSERT/UPDATE dedup keyed on
 *   the same columns the COALESCE index covers (NULLs compared via `.is`), which reproduces the
 *   index's semantics from the app layer. This is idempotent: re-running extraction updates the
 *   existing draft row rather than inserting a duplicate.
 */

import {
  type ExtractedScheduleDraft,
  type ExtractedSpecDraft,
  isSafetyCriticalName,
  isSpecValueInRange,
  type MaintenanceSourceType,
  type MotorcycleVariant,
} from '@motovault/types';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

// --- Pilot constants (Africa Twin DCT) --------------------------------------
const PILOT = {
  MAKE: 'HONDA', // ALL-CAPS, NHTSA-normalized (confirm model string at execution)
  MODEL: 'CRF1100',
  VARIANT: 'DCT' as MotorcycleVariant,
} as const;

const CONTENT_TYPE_EXTRACTION = 'maintenance_extraction' as const;
const EXTRACTION_MODEL = 'developer-run-extraction' as const;

// --- Input shapes -----------------------------------------------------------

/** Identity of the manual a run sourced from — registered in `maintenance_data_sources`. */
export interface RegisterSourceInput {
  sourceType: MaintenanceSourceType;
  title: string;
  editionLanguage?: string;
  /** The edition/market the values apply to (e.g. 'EU'). Recorded for traceability. */
  marketApplicability?: string;
  /** Edition / part no., e.g. '35MLN610'. */
  reference?: string;
  /** Link or Supabase Storage path to the doc (nullable). */
  sourceUrl?: string;
  retrievedAt?: Date;
}

/** A registered source row, mapped to camelCase. */
export interface MaintenanceDataSource {
  id: string;
  sourceType: string;
  title: string;
  reference: string | null;
}

export interface PersistDraftsInput {
  sourceId: string;
  schedules: ExtractedScheduleDraft[];
  specs: ExtractedSpecDraft[];
  make?: string;
  model?: string;
  variant?: MotorcycleVariant;
  yearFrom?: number | null;
  yearTo?: number | null;
}

export interface PersistDraftsResult {
  schedulesUpserted: number;
  specsUpserted: number;
  specsRejected: number;
  /** spec names rejected by the per-spec_type range guard. */
  rejectedSpecNames: string[];
}

@Injectable()
export class MaintenanceSourcingService {
  private readonly logger = new Logger(MaintenanceSourcingService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  /**
   * Register (or find) the `maintenance_data_sources` row for a run. Idempotent on
   * (source_type, title, reference) so re-running an extraction reuses the same provenance row.
   */
  async registerSource(input: RegisterSourceInput): Promise<MaintenanceDataSource> {
    const existing = await this.supabase
      .from('maintenance_data_sources')
      .select('id, source_type, title, reference')
      .eq('source_type', input.sourceType)
      .eq('title', input.title)
      .eq('reference', input.reference ?? '')
      .maybeSingle();

    if (existing.error) {
      throw new Error(`Failed to look up maintenance source: ${existing.error.message}`);
    }
    if (existing.data) return this.mapSource(existing.data);

    const { data, error } = await this.supabase
      .from('maintenance_data_sources')
      .insert({
        source_type: input.sourceType,
        title: input.title,
        edition_language: input.editionLanguage ?? null,
        market_applicability: input.marketApplicability ?? null,
        reference: input.reference ?? null,
        source_url: input.sourceUrl ?? null,
        retrieved_at: (input.retrievedAt ?? new Date()).toISOString(),
      })
      .select('id, source_type, title, reference')
      .single();

    if (error || !data) {
      throw new Error(`Failed to register maintenance source: ${error?.message ?? 'no row'}`);
    }
    return this.mapSource(data);
  }

  /**
   * Persist validated draft rows. Inputs are assumed already Zod-validated upstream
   * (ExtractedScheduleDraftSchema / ExtractedSpecDraftSchema); this layer applies the
   * server-side safety-critical classification, the spec range guard, and idempotent
   * select-then-upsert dedup, then logs the run.
   */
  async persistDrafts(input: PersistDraftsInput): Promise<PersistDraftsResult> {
    const make = (input.make ?? PILOT.MAKE).toUpperCase();
    const model = input.model ?? PILOT.MODEL;
    const variant = input.variant ?? PILOT.VARIANT;
    const yearFrom = input.yearFrom ?? null;
    const yearTo = input.yearTo ?? null;

    const result: PersistDraftsResult = {
      schedulesUpserted: 0,
      specsUpserted: 0,
      specsRejected: 0,
      rejectedSpecNames: [],
    };

    try {
      for (const draft of input.schedules) {
        await this.upsertScheduleDraft(draft, {
          sourceId: input.sourceId,
          make,
          model,
          variant,
          yearFrom,
          yearTo,
        });
        result.schedulesUpserted += 1;
      }

      for (const draft of input.specs) {
        // (c) Reject any draft failing the per-spec_type physical range guard before insert.
        if (!isSpecValueInRange(draft)) {
          result.specsRejected += 1;
          result.rejectedSpecNames.push(draft.specName);
          this.logger.warn(
            `Rejected out-of-range spec "${draft.specName}" (${draft.specType}=${draft.valueNumeric})`,
          );
          continue;
        }
        await this.upsertSpecDraft(draft, {
          sourceId: input.sourceId,
          make,
          model,
          variant,
          yearFrom,
        });
        result.specsUpserted += 1;
      }

      await this.logRun('success', {
        make,
        model,
        variant,
        ...result,
      });
      return result;
    } catch (err) {
      await this.logRun('failed', {
        make,
        model,
        variant,
        error: err instanceof Error ? err.message : 'Unknown error',
      });
      throw err;
    }
  }

  // --- Schedule (interval) drafts -------------------------------------------

  private async upsertScheduleDraft(
    draft: ExtractedScheduleDraft,
    keys: {
      sourceId: string;
      make: string;
      model: string;
      variant: MotorcycleVariant;
      yearFrom: number | null;
      yearTo: number | null;
    },
  ): Promise<void> {
    const row = {
      make: keys.make,
      model: keys.model,
      variant: keys.variant,
      year_from: keys.yearFrom,
      year_to: keys.yearTo,
      task_name: draft.taskName,
      interval_km: draft.intervalKm ?? null,
      interval_days: draft.intervalDays ?? null,
      priority: draft.priority,
      source_id: keys.sourceId,
      source_page: draft.sourcePage,
      source_context: draft.sourceContext ?? null,
      // KTD 8: server-set from the allowlist, NEVER from model output.
      is_safety_critical: isSafetyCriticalName(draft.taskName),
      // U2: drafts are unverified until human approval (U4).
      is_verified: false,
    };

    // Natural key mirrors the COALESCE expression index in 00149:
    // (make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), COALESCE(year_to,0), task_name)
    const existingId = await this.findScheduleId(keys, draft.taskName);
    if (existingId) {
      const { error } = await this.supabase
        .from('oem_maintenance_schedules')
        .update(row)
        .eq('id', existingId);
      if (error) throw new Error(`Failed to update schedule draft: ${error.message}`);
      return;
    }
    const { error } = await this.supabase.from('oem_maintenance_schedules').insert(row);
    if (error) throw new Error(`Failed to insert schedule draft: ${error.message}`);
  }

  private async findScheduleId(
    keys: {
      make: string;
      model: string;
      variant: MotorcycleVariant;
      yearFrom: number | null;
      yearTo: number | null;
    },
    taskName: string,
  ): Promise<string | null> {
    let query = this.supabase
      .from('oem_maintenance_schedules')
      .select('id')
      .eq('make', keys.make)
      .eq('model', keys.model)
      .eq('variant', keys.variant)
      .eq('task_name', taskName);
    query =
      keys.yearFrom == null ? query.is('year_from', null) : query.eq('year_from', keys.yearFrom);
    query = keys.yearTo == null ? query.is('year_to', null) : query.eq('year_to', keys.yearTo);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Failed to look up schedule draft: ${error.message}`);
    return data?.id ?? null;
  }

  // --- Spec (point-value) drafts --------------------------------------------

  private async upsertSpecDraft(
    draft: ExtractedSpecDraft,
    keys: {
      sourceId: string;
      make: string;
      model: string;
      variant: MotorcycleVariant;
      yearFrom: number | null;
    },
  ): Promise<void> {
    const row = {
      make: keys.make,
      model: keys.model,
      variant: keys.variant,
      year_from: keys.yearFrom,
      spec_type: draft.specType,
      spec_name: draft.specName,
      // (c) value_numeric is already a number (parsed once via parseMetricValue upstream).
      value_numeric: draft.valueNumeric,
      value_display: draft.valueDisplay ?? null,
      unit: draft.unit,
      source_id: keys.sourceId,
      source_page: draft.sourcePage,
      source_context: draft.sourceContext ?? null,
      // KTD 8: server-set from the allowlist, NEVER from model output.
      is_safety_critical: isSafetyCriticalName(draft.specName),
      is_verified: false,
    };

    // Natural key mirrors uq_motorcycle_specs_natural_key:
    // (make, COALESCE(model,''), COALESCE(variant,''), COALESCE(year_from,0), spec_type, spec_name)
    const existingId = await this.findSpecId(keys, draft);
    if (existingId) {
      const { error } = await this.supabase
        .from('motorcycle_specs')
        .update(row)
        .eq('id', existingId);
      if (error) throw new Error(`Failed to update spec draft: ${error.message}`);
      return;
    }
    const { error } = await this.supabase.from('motorcycle_specs').insert(row);
    if (error) throw new Error(`Failed to insert spec draft: ${error.message}`);
  }

  private async findSpecId(
    keys: {
      make: string;
      model: string;
      variant: MotorcycleVariant;
      yearFrom: number | null;
    },
    draft: ExtractedSpecDraft,
  ): Promise<string | null> {
    let query = this.supabase
      .from('motorcycle_specs')
      .select('id')
      .eq('make', keys.make)
      .eq('model', keys.model)
      .eq('variant', keys.variant)
      .eq('spec_type', draft.specType)
      .eq('spec_name', draft.specName);
    query =
      keys.yearFrom == null ? query.is('year_from', null) : query.eq('year_from', keys.yearFrom);

    const { data, error } = await query.maybeSingle();
    if (error) throw new Error(`Failed to look up spec draft: ${error.message}`);
    return data?.id ?? null;
  }

  // --- Run logging ----------------------------------------------------------

  /** Log the extraction run to content_generation_log (shape per article-generator.service.ts). */
  private async logRun(
    status: 'success' | 'failed',
    detail: Record<string, unknown>,
  ): Promise<void> {
    const { error } = await this.supabase.from('content_generation_log').insert({
      content_type: CONTENT_TYPE_EXTRACTION,
      model: EXTRACTION_MODEL,
      status,
      error_message: status === 'failed' ? String(detail.error ?? 'Unknown error') : null,
    });
    if (error) {
      this.logger.error('Failed to log maintenance extraction run', error);
    }
  }

  private mapSource(row: {
    id: string;
    source_type: string;
    title: string;
    reference: string | null;
  }): MaintenanceDataSource {
    return {
      id: row.id,
      sourceType: row.source_type,
      title: row.title,
      reference: row.reference,
    };
  }
}
