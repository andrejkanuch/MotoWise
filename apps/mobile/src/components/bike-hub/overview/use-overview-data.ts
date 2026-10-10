import {
  DocumentCategoriesDocument,
  ExpensesByMotorcycleDocument,
  MotorcycleRecallsDocument,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { useCurrency } from '@/hooks/use-currency';
import { type AttentionResult, getNextUp, rankAttention } from '@/lib/bike-hub/attention';
import type { HubUnit } from '@/lib/bike-hub/constants';
import { type CostsSummary, summariseCosts } from '@/lib/bike-hub/costs-summary';
import { type DocumentSignal, getDocumentSignals } from '@/lib/bike-hub/documents';
import { getRideStatus, type RideStatusResult } from '@/lib/bike-hub/ride-status';
import type { TaskDue } from '@/lib/bike-hub/task-due';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';
import { type HubNote, useNotes } from '../notes/use-notes';
import type { BikeHubData, HubBike, HubTask } from '../shell/use-bike-hub-data';
import { useToday } from '../shell/use-today';

const RECALLS_STALE_MS = 24 * 60 * 60 * 1000;
const NO_CATEGORIES: never[] = [];
/**
 * The Overview degrades block by block (recall count fallback, ride-status and
 * costs / notes error rows with Retry), so its own queries never raise the
 * global alert. Observers elsewhere of the same keys pass the same meta.
 */
const OWN_ERROR_UI = QUERY_META.OWN_ERROR_UI;

interface Block {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
  /** The block still shows its last data, but the latest refetch failed. */
  refreshFailed?: boolean;
}

export interface OverviewData {
  today: Date;
  status: RideStatusResult;
  /**
   * Whether `status` can be trusted. It is computed from tasks, documents AND
   * document categories (which documents block riding): while any is loading or
   * has failed there is no verdict — never "Ready to ride" or "Nothing tracked
   * yet" off an empty, not-yet-loaded list.
   */
  statusSource: Block;
  attention: AttentionResult;
  nextUp: { task: HubTask; due: TaskDue } | null;
  /** Loading / error of the tasks behind status, attention and next up. */
  tasks: Block;
  costs: Block & { year: number; summary: CostsSummary };
  notes: Block & { items: HubNote[] };
  /** Expired or expiring documents, most urgent first. */
  documentSignals: DocumentSignal[];
  documentCount: number;
  /** The recalls list is loaded (so "no open recalls" is a fact, not a guess). */
  recallsKnown: boolean;
}

/**
 * Everything the Overview shows, composed from the shell's queries plus recalls,
 * document categories, two years of expenses and the notes. Each block carries
 * its own loading / error state, so one failing query degrades one block.
 *
 * `today` is passed in so tests can pin the date; the screen omits it.
 */
export function useOverviewData(
  bike: HubBike,
  shell: Pick<
    BikeHubData,
    | 'tasks'
    | 'tasksLoading'
    | 'tasksError'
    | 'refetchTasks'
    | 'tasksRefreshFailed'
    | 'documents'
    | 'documentsLoading'
    | 'documentsError'
    | 'refetchDocuments'
  >,
  unit: HubUnit,
  now?: Date,
): OverviewData {
  const id = bike.id;
  const today = useToday(now);
  const year = today.getFullYear();

  const recallsQuery = useQuery({
    queryKey: queryKeys.motorcycleRecalls.byMotorcycle(id),
    queryFn: () => gqlFetcher(MotorcycleRecallsDocument, { motorcycleId: id }),
    staleTime: RECALLS_STALE_MS,
    retry: 1,
    meta: OWN_ERROR_UI,
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.documents.categories(true),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
    meta: OWN_ERROR_UI,
  });
  const categoriesLoading = categoriesQuery.data === undefined && !categoriesQuery.isError;
  const categoriesError = categoriesQuery.isError && !categoriesQuery.data;
  // Keyed with the year: the bare `byMotorcycle` key is shared with other variables.
  const currentYear = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(id), year],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId: id, year }),
    meta: OWN_ERROR_UI,
  });
  const previousYear = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(id), year - 1],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId: id, year: year - 1 }),
    meta: OWN_ERROR_UI,
  });
  const notes = useNotes(id);

  // `null` = unknown (loading or failed): the count persisted on the bike stands in.
  const recalls = recallsQuery.data?.motorcycleRecalls.recalls ?? null;
  const categories = categoriesQuery.data?.documentCategories ?? NO_CATEGORIES;
  const { tasks, documents } = shell;
  const odometer = bike.currentMileage;
  const recallCount = bike.recallCount;

  const derived = useMemo(() => {
    const context = { odometer, today, unit };
    const nextUp = getNextUp(tasks, context);
    return {
      nextUp,
      status: getRideStatus({ tasks, documents, categories, recalls, recallCount, ...context }),
      // The Next-up task has its own block, so it is not listed twice.
      attention: rankAttention({
        tasks,
        documents,
        categories,
        recalls,
        recallCount,
        excludeTaskIds: nextUp ? [nextUp.task.id] : [],
        ...context,
      }),
      documentSignals: getDocumentSignals(documents, categories, today),
    };
  }, [tasks, documents, categories, recalls, recallCount, odometer, today, unit]);

  const { currency: fallbackCurrency } = useCurrency();
  const summary = useMemo(
    () =>
      summariseCosts({
        currentYearExpenses: currentYear.data?.expenses,
        previousYearExpenses: previousYear.data?.expenses,
        today,
        fallbackCurrency,
      }),
    [currentYear.data, previousYear.data, today, fallbackCurrency],
  );

  return {
    today,
    ...derived,
    statusSource: {
      isLoading: shell.tasksLoading || shell.documentsLoading || categoriesLoading,
      isError: shell.tasksError || shell.documentsError || categoriesError,
      refetch: () => {
        if (shell.tasksError) shell.refetchTasks();
        if (shell.documentsError) shell.refetchDocuments();
        if (categoriesError) void categoriesQuery.refetch();
      },
    },
    tasks: {
      isLoading: shell.tasksLoading,
      isError: shell.tasksError,
      refetch: shell.refetchTasks,
      refreshFailed: shell.tasksRefreshFailed,
    },
    costs: {
      year,
      summary,
      isLoading: currentYear.isLoading,
      isError: currentYear.isError && !currentYear.data,
      // The card shows both years (YTD and the year-over-year line): once this
      // year is on screen, a failed fetch of either year leaves part of it
      // stale or missing — say so, with Retry (which refetches both).
      refreshFailed: !!currentYear.data && (currentYear.isError || previousYear.isError),
      refetch: () => {
        void currentYear.refetch();
        void previousYear.refetch();
      },
    },
    notes: {
      items: notes.notes,
      isLoading: notes.isLoading,
      isError: notes.isError,
      refetch: notes.refetch,
      refreshFailed: notes.refreshFailed,
    },
    documentCount: documents.length,
    recallsKnown: recalls !== null,
  };
}
