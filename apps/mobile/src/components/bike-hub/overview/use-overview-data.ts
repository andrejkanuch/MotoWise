import {
  DocumentCategoriesDocument,
  ExpensesByMotorcycleDocument,
  MotorcycleRecallsDocument,
} from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useMemo } from 'react';
import { type AttentionResult, getNextUp, rankAttention } from '../../../lib/bike-hub/attention';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { type CostsSummary, summariseCosts } from '../../../lib/bike-hub/costs-summary';
import { type DocumentSignal, getDocumentSignals } from '../../../lib/bike-hub/documents';
import { getRideStatus, type RideStatusResult } from '../../../lib/bike-hub/ride-status';
import type { TaskDue } from '../../../lib/bike-hub/task-due';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { type HubNote, useNotes } from '../notes/use-notes';
import type { BikeHubData, HubBike, HubTask } from '../shell/use-bike-hub-data';

const RECALLS_STALE_MS = 24 * 60 * 60 * 1000;
const NO_CATEGORIES: never[] = [];

interface Block {
  isLoading: boolean;
  isError: boolean;
  refetch: () => void;
}

export interface OverviewData {
  today: Date;
  status: RideStatusResult;
  attention: AttentionResult;
  nextUp: { task: HubTask; due: TaskDue } | null;
  /** Loading / error of the tasks behind status, attention and next up. */
  tasks: Block;
  costs: Block & { year: number; summary: CostsSummary };
  notes: Block & { items: HubNote[] };
  /** Expired or expiring documents, most urgent first. */
  documentSignals: DocumentSignal[];
  documentCount: number;
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
  shell: Pick<BikeHubData, 'tasks' | 'tasksLoading' | 'tasksError' | 'refetchTasks' | 'documents'>,
  unit: HubUnit,
  now?: Date,
): OverviewData {
  const id = bike.id;
  // One Date per mount keeps the memoised derivations stable across renders.
  const today = useMemo(() => now ?? new Date(), [now]);
  const year = today.getFullYear();

  const recallsQuery = useQuery({
    queryKey: queryKeys.motorcycleRecalls.byMotorcycle(id),
    queryFn: () => gqlFetcher(MotorcycleRecallsDocument, { motorcycleId: id }),
    staleTime: RECALLS_STALE_MS,
    retry: 1,
  });
  const categoriesQuery = useQuery({
    queryKey: queryKeys.documents.categories(true),
    queryFn: () => gqlFetcher(DocumentCategoriesDocument, { includeHidden: true }),
  });
  // Keyed with the year: the bare `byMotorcycle` key is shared with other variables.
  const currentYear = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(id), year],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId: id, year }),
  });
  const previousYear = useQuery({
    queryKey: [...queryKeys.expenses.byMotorcycle(id), year - 1],
    queryFn: () => gqlFetcher(ExpensesByMotorcycleDocument, { motorcycleId: id, year: year - 1 }),
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

  const summary = useMemo(
    () =>
      summariseCosts({
        currentYearExpenses: currentYear.data?.expenses,
        previousYearExpenses: previousYear.data?.expenses,
        today,
      }),
    [currentYear.data, previousYear.data, today],
  );

  return {
    today,
    ...derived,
    tasks: {
      isLoading: shell.tasksLoading,
      isError: shell.tasksError,
      refetch: shell.refetchTasks,
    },
    costs: {
      year,
      summary,
      isLoading: currentYear.isLoading,
      isError: currentYear.isError && !currentYear.data,
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
    },
    documentCount: documents.length,
  };
}
