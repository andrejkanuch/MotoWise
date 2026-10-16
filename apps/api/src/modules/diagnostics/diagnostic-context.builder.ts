import {
  EXPENSE_CATEGORY_META,
  type ExpenseCategory,
  MaintenanceTaskStatus,
  type MeasurementSystem,
  mileageUnitLabel,
  RIDE_STATUS,
} from '@motovault/types';
import type { Tables } from '@motovault/types/database';
import { Inject, Injectable, Logger } from '@nestjs/common';
import type { PostgrestError, SupabaseClient } from '@supabase/supabase-js';
import { subDays, subMonths } from 'date-fns';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import {
  BIKE_CONTEXT_CAPS,
  BIKE_CONTEXT_SCOPE,
  type BikeContextData,
  type BikeContextScope,
  type BikeProfile,
  detectSymptomKeywords,
  formatBikeContext,
  type SymptomInput,
} from './diagnostic-context.format';

/**
 * Rows fetched per section. Larger than the display caps so symptom relevance
 * has older items to choose from (e.g. a stator replaced 14 months ago behind
 * eight newer oil changes). Still bounded, newest first.
 */
const FETCH_LIMIT = 40;
const RIDE_FETCH_LIMIT = 200;
const RIDE_LOOKBACK_DAYS = 365;
const EXPENSE_LOOKBACK_MONTHS = 24;
const DIAGNOSIS_LOOKBACK_MONTHS = 12;

/** `diagnostics.status` value written by DiagnosticAiService on success. */
const DIAGNOSTIC_STATUS_COMPLETED = 'completed';

const OPEN_TASK_STATUSES = [MaintenanceTaskStatus.PENDING, MaintenanceTaskStatus.IN_PROGRESS];

const CATCH_ALL_EXPENSE_CATEGORY: ExpenseCategory = 'other';

/**
 * Expense categories whose money stays in the machine (parts, service, tyres,
 * accessories, mods). `other` is excluded: it is flagged as investment for the
 * dashboard split but says nothing mechanical.
 */
export const MECHANICAL_EXPENSE_CATEGORIES: readonly string[] = EXPENSE_CATEGORY_META.filter(
  (meta) => meta.investment && meta.key !== CATCH_ALL_EXPENSE_CATEGORY,
).map((meta) => meta.key);

const SECTION = {
  COMPLETED_SERVICES: 'completedServices',
  OPEN_SERVICES: 'openServices',
  EXPENSES: 'expenses',
  RIDES: 'rides',
  PREVIOUS_DIAGNOSES: 'previousDiagnoses',
  NOTES: 'notes',
} as const;
type SectionKey = (typeof SECTION)[keyof typeof SECTION];

/** Scopes whose consent copy covers the bike profile (variant, ownership start, odometer date). */
const PROFILE_SCOPES: ReadonlySet<BikeContextScope> = new Set([BIKE_CONTEXT_SCOPE.FULL]);

/** Which sections each consent scope covers. */
const SCOPE_SECTIONS: Record<BikeContextScope, readonly SectionKey[]> = {
  [BIKE_CONTEXT_SCOPE.MAINTENANCE]: [SECTION.COMPLETED_SERVICES, SECTION.OPEN_SERVICES],
  [BIKE_CONTEXT_SCOPE.FULL]: Object.values(SECTION),
};

type CompletedTaskRow = Pick<
  Tables<'maintenance_tasks'>,
  'title' | 'description' | 'completed_at' | 'completed_mileage'
>;
type OpenTaskRow = Pick<
  Tables<'maintenance_tasks'>,
  'title' | 'description' | 'due_date' | 'target_mileage' | 'priority'
>;
type ExpenseRow = Pick<Tables<'expenses'>, 'category' | 'item_name' | 'description' | 'date'>;
type NoteRow = Pick<Tables<'notes'>, 'body' | 'created_at' | 'odometer'>;
type RideRow = Pick<Tables<'rides'>, 'started_at' | 'distance_m'>;
type DiagnosisRow = Pick<
  Tables<'diagnostics'>,
  'created_at' | 'severity' | 'description' | 'free_text_description'
> & { part: string | null };

export interface BuildBikeContextParams {
  userId: string;
  motorcycleId: string;
  /** The diagnostic being generated right now — never feed it back as history. */
  currentDiagnosticId: string;
  scope: BikeContextScope;
  measurementSystem: MeasurementSystem;
  currentMileage?: number | null;
  profile?: BikeProfile;
  symptoms: SymptomInput;
  now?: Date;
}

/**
 * Pick the consent scope from the submit flags. `includeBikeHistory` is sent
 * only by builds whose toggle copy discloses the full scope; older binaries
 * send just `includeMaintenanceHistory`, whose copy promised services only.
 */
export function resolveBikeContextScope(flags: {
  includeBikeHistory?: boolean | null;
  includeMaintenanceHistory?: boolean | null;
}): BikeContextScope | null {
  if (flags.includeBikeHistory != null) {
    return flags.includeBikeHistory ? BIKE_CONTEXT_SCOPE.FULL : null;
  }
  return flags.includeMaintenanceHistory ? BIKE_CONTEXT_SCOPE.MAINTENANCE : null;
}

/**
 * supabase-js resolves `{ error }` instead of rejecting; turn it into a rejection for allSettled.
 * The Row aliases above must match each reader's select string — the untyped client does not check it.
 */
function rowsOrThrow<T>(result: { data: unknown; error: PostgrestError | null }): T[] {
  if (result.error) throw new Error(result.error.message);
  return (result.data ?? []) as T[];
}

/**
 * Reads everything we know about one bike, with the rider's own JWT (RLS
 * enforced), and renders the bounded `<bike_context>` text for the diagnostic
 * prompt. Best effort: a section that fails to load is logged by name and
 * left out — it never fails the diagnosis.
 */
@Injectable()
export class DiagnosticContextBuilder {
  private readonly logger = new Logger(DiagnosticContextBuilder.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async build(params: BuildBikeContextParams): Promise<string | undefined> {
    const now = params.now ?? new Date();
    const sections = SCOPE_SECTIONS[params.scope];
    const readers = this.sectionReaders(params, now);

    const settled = await Promise.allSettled(sections.map((key) => readers[key]()));

    const data: BikeContextData = PROFILE_SCOPES.has(params.scope)
      ? { profile: params.profile }
      : {};
    settled.forEach((outcome, index) => {
      const key = sections[index];
      if (outcome.status === 'fulfilled') {
        Object.assign(data, outcome.value);
      } else {
        // ids + section name only — row content is the rider's private data
        this.logger.warn(
          `bike context section "${key}" skipped for motorcycleId=${params.motorcycleId}: ${
            outcome.reason instanceof Error ? outcome.reason.message : 'unknown error'
          }`,
        );
      }
    });

    return formatBikeContext(data, {
      now,
      mileageUnit: mileageUnitLabel(params.measurementSystem),
      currentMileage: params.currentMileage,
      symptomKeywords: detectSymptomKeywords(params.symptoms),
    });
  }

  private sectionReaders(
    params: BuildBikeContextParams,
    now: Date,
  ): Record<SectionKey, () => Promise<Partial<BikeContextData>>> {
    const { userId, motorcycleId } = params;
    const forBike = (table: string, columns: string) =>
      this.supabase
        .from(table)
        .select(columns)
        .eq('user_id', userId)
        .eq('motorcycle_id', motorcycleId);

    return {
      [SECTION.COMPLETED_SERVICES]: async () => {
        const rows = rowsOrThrow<CompletedTaskRow>(
          await forBike('maintenance_tasks', 'title, description, completed_at, completed_mileage')
            .eq('status', MaintenanceTaskStatus.COMPLETED)
            .is('deleted_at', null)
            .order('completed_at', { ascending: false, nullsFirst: false })
            .limit(FETCH_LIMIT),
        );
        return {
          completedServices: rows.map((row) => ({
            title: row.title,
            description: row.description,
            completedAt: row.completed_at,
            completedMileage: row.completed_mileage,
          })),
        };
      },

      [SECTION.OPEN_SERVICES]: async () => {
        const rows = rowsOrThrow<OpenTaskRow>(
          await forBike(
            'maintenance_tasks',
            'title, description, due_date, target_mileage, priority',
          )
            .in('status', OPEN_TASK_STATUSES)
            .is('deleted_at', null)
            .order('due_date', { ascending: true, nullsFirst: false })
            .limit(FETCH_LIMIT),
        );
        return {
          openServices: rows.map((row) => ({
            title: row.title,
            description: row.description,
            dueDate: row.due_date,
            targetMileage: row.target_mileage,
            priority: row.priority,
          })),
        };
      },

      [SECTION.EXPENSES]: async () => {
        const rows = rowsOrThrow<ExpenseRow>(
          await forBike('expenses', 'category, item_name, description, date')
            .in('category', [...MECHANICAL_EXPENSE_CATEGORIES])
            .is('deleted_at', null)
            .gte('date', subMonths(now, EXPENSE_LOOKBACK_MONTHS).toISOString().slice(0, 10))
            .order('date', { ascending: false })
            .limit(FETCH_LIMIT),
        );
        return {
          expenses: rows.map((row) => ({
            category: row.category,
            itemName: row.item_name,
            description: row.description,
            date: row.date,
          })),
        };
      },

      [SECTION.RIDES]: async () => {
        const rows = rowsOrThrow<RideRow>(
          await forBike('rides', 'started_at, distance_m')
            .eq('status', RIDE_STATUS.COMPLETED)
            .is('deleted_at', null)
            .gte('started_at', subDays(now, RIDE_LOOKBACK_DAYS).toISOString())
            .order('started_at', { ascending: false })
            .limit(RIDE_FETCH_LIMIT),
        );
        return {
          rides: rows.map((row) => ({ startedAt: row.started_at, distanceM: row.distance_m })),
        };
      },

      [SECTION.PREVIOUS_DIAGNOSES]: async () => {
        const rows = rowsOrThrow<DiagnosisRow>(
          await forBike(
            'diagnostics',
            'created_at, severity, description, free_text_description, part:result_json->>part',
          )
            .eq('status', DIAGNOSTIC_STATUS_COMPLETED)
            .neq('id', params.currentDiagnosticId)
            .gte('created_at', subMonths(now, DIAGNOSIS_LOOKBACK_MONTHS).toISOString())
            .order('created_at', { ascending: false })
            .limit(BIKE_CONTEXT_CAPS.PREVIOUS_DIAGNOSES),
        );
        return {
          previousDiagnoses: rows.map((row) => ({
            createdAt: row.created_at,
            severity: row.severity,
            part: row.part,
            description: row.description,
            reportedSymptom: row.free_text_description,
          })),
        };
      },

      [SECTION.NOTES]: async () => {
        const rows = rowsOrThrow<NoteRow>(
          await forBike('notes', 'body, created_at, odometer')
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(FETCH_LIMIT),
        );
        return {
          notes: rows.map((row) => ({
            body: row.body,
            createdAt: row.created_at,
            odometer: row.odometer,
          })),
        };
      },
    };
  }
}
