import {
  CreateNoteDocument,
  CreateTaskFromNoteDocument,
  DeleteNoteDocument,
  type MaintenanceTaskStatus,
  MaintenanceTasksByMotorcycleDocument,
  NotesByMotorcycleDocument,
  type NotesByMotorcycleQuery,
  UpdateNoteDocument,
} from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useMemo } from 'react';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import type { NoteSource } from '@/lib/bike-hub/constants';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { QUERY_META } from '@/lib/query-meta';
import { usePendingDeleteStore } from '@/stores/pending-delete.store';

export type HubNote = NotesByMotorcycleQuery['notes'][number];

const NO_NOTES: HubNote[] = [];
const OPTIMISTIC_PREFIX = 'optimistic-';
/**
 * Every caller of these mutations, and of the notes query, shows its own inline
 * error (or its own alert), so the query client's global "Error" alert must stay
 * out of the way. For mutations it only skips those with `onError` in their
 * options; for queries it fires on any first-load failure.
 */
const { OWN_ERROR_UI } = QUERY_META;

export function isOptimisticNote(note: Pick<HubNote, 'id'>): boolean {
  return note.id.startsWith(OPTIMISTIC_PREFIX);
}

/** A bike's notes, newest first, without the ones inside their delete-undo window. */
export function useNotes(motorcycleId: string) {
  const hiddenIds = usePendingDeleteStore((state) => state.hiddenIds);
  const query = useQuery({
    queryKey: queryKeys.notes.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(NotesByMotorcycleDocument, { motorcycleId }),
    enabled: !!motorcycleId,
    // The notes block and the Notes screen render their own error + Retry.
    meta: OWN_ERROR_UI,
  });
  const all = query.data?.notes ?? NO_NOTES;
  const notes = useMemo(() => all.filter((note) => !hiddenIds[note.id]), [all, hiddenIds]);
  return {
    notes,
    isLoading: query.isLoading,
    isError: query.isError && !query.data,
    /** Notes are shown from the cache: the latest refetch failed. */
    refreshFailed: query.isError && !!query.data,
    refetch: () => void query.refetch(),
    /** Pull-to-refresh: resolves when the refetch settles (failures surface as `refreshFailed`). */
    refresh: async () => {
      await query.refetch();
    },
  };
}

/**
 * Status of each of the bike's tasks, by id — lets a note's task link say
 * whether the task is still open instead of repeating its title. Shares the
 * hub's tasks query (same key), so it is usually a cache hit; a failure only
 * means the link falls back to a plain "Linked task".
 */
export function useTaskStatuses(motorcycleId: string): ReadonlyMap<string, MaintenanceTaskStatus> {
  const query = useQuery({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
    queryFn: () => gqlFetcher(MaintenanceTasksByMotorcycleDocument, { motorcycleId }),
    enabled: !!motorcycleId,
    // Same meta as the hub's observer of this key; a failure leaves the plain link.
    meta: OWN_ERROR_UI,
  });
  const tasks = query.data?.maintenanceTasks;
  return useMemo(
    () => new Map((tasks ?? []).map((task) => [task.id, task.status] as const)),
    [tasks],
  );
}

export interface CreateNoteVariables {
  motorcycleId: string;
  /** Already trimmed and non-empty. */
  text: string;
  /** `null` = no odometer stamp. */
  odometer: number | null;
  alsoCreateTask?: boolean;
  source: NoteSource;
  /** Photos are uploaded after the note exists; only reported to analytics here. */
  hasPhoto?: boolean;
}

/**
 * Creates a note with an optimistic row at the top of the bike's list. A failed
 * create removes the row again; the caller keeps the typed text. No gate of any
 * kind — writing a note is always free.
 */
export function useCreateNote() {
  const queryClient = useQueryClient();
  return useMutation({
    // Not idempotent: a retry after the server saved the note (the response was
    // lost) would create a second note. The sheet keeps the text for a manual retry.
    retry: false,
    mutationFn: ({ motorcycleId, text, odometer, alsoCreateTask }: CreateNoteVariables) =>
      gqlFetcher(CreateNoteDocument, {
        // `createNote` takes a number or nothing: an explicit null is rejected by
        // its input validation (only `updateNote` accepts null, to clear a stamp).
        input: {
          motorcycleId,
          text,
          odometer: odometer ?? undefined,
          alsoCreateTask: alsoCreateTask ?? false,
        },
      }),
    onMutate: async (variables) => {
      const key = queryKeys.notes.byMotorcycle(variables.motorcycleId);
      await queryClient.cancelQueries({ queryKey: key });
      const previous = queryClient.getQueryData<NotesByMotorcycleQuery>(key);
      const now = new Date().toISOString();
      const optimistic: HubNote = {
        id: `${OPTIMISTIC_PREFIX}${now}`,
        motorcycleId: variables.motorcycleId,
        text: variables.text,
        odometer: variables.odometer,
        createdAt: now,
        updatedAt: now,
        photos: [],
      };
      queryClient.setQueryData<NotesByMotorcycleQuery>(key, {
        notes: [optimistic, ...(previous?.notes ?? [])],
      });
      return { key, previous, optimisticId: optimistic.id };
    },
    onError: (_error, _variables, context) => {
      if (!context) return;
      queryClient.setQueryData(context.key, context.previous);
    },
    onSuccess: (data, variables, context) => {
      // Swap the optimistic row for the saved one so photos can attach to its id.
      queryClient.setQueryData<NotesByMotorcycleQuery>(context.key, (current) => ({
        notes: (current?.notes ?? []).map((note) =>
          note.id === context.optimisticId ? data.createNote : note,
        ),
      }));
      trackEvent(AnalyticsEvent.NOTE_CREATED, {
        motorcycle_id: variables.motorcycleId,
        source: variables.source,
        has_photo: variables.hasPhoto ?? false,
        also_task: variables.alsoCreateTask ?? false,
      });
    },
    onSettled: (_data, _error, variables) => {
      queryClient.invalidateQueries({
        queryKey: queryKeys.notes.byMotorcycle(variables.motorcycleId),
      });
      if (variables.alsoCreateTask) invalidateTasks(queryClient, variables.motorcycleId);
    },
  });
}

function invalidateTasks(queryClient: ReturnType<typeof useQueryClient>, motorcycleId: string) {
  queryClient.invalidateQueries({
    queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
  });
  queryClient.invalidateQueries({ queryKey: queryKeys.maintenanceTasks.allUser });
}

export function useUpdateNote(motorcycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: OWN_ERROR_UI,
    mutationFn: (variables: { id: string; text: string; odometer: number | null }) =>
      gqlFetcher(UpdateNoteDocument, {
        id: variables.id,
        input: { text: variables.text, odometer: variables.odometer },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.notes.byMotorcycle(motorcycleId) });
    },
  });
}

/**
 * The server delete behind the undo window (`soft_delete_note`). On success the
 * note leaves the cache before it is un-hidden, so it cannot flash back.
 */
export function useDeleteNote(motorcycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: OWN_ERROR_UI,
    mutationFn: (id: string) => gqlFetcher(DeleteNoteDocument, { id }),
    onSuccess: (_data, id) => {
      const key = queryKeys.notes.byMotorcycle(motorcycleId);
      queryClient.setQueryData<NotesByMotorcycleQuery>(key, (current) =>
        current ? { notes: current.notes.filter((note) => note.id !== id) } : current,
      );
      queryClient.invalidateQueries({ queryKey: key });
      trackEvent(AnalyticsEvent.NOTE_DELETED, { motorcycle_id: motorcycleId });
    },
  });
}

/** "Make it a task": creates a low-priority undated task from an existing note. */
export function useCreateTaskFromNote(motorcycleId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    meta: OWN_ERROR_UI,
    // Not idempotent either: a retried call can create a second task.
    retry: false,
    mutationFn: (noteId: string) => gqlFetcher(CreateTaskFromNoteDocument, { noteId }),
    onSuccess: (data) => {
      const key = queryKeys.notes.byMotorcycle(motorcycleId);
      queryClient.setQueryData<NotesByMotorcycleQuery>(key, (current) =>
        current
          ? {
              notes: current.notes.map((note) =>
                note.id === data.createTaskFromNote.id ? data.createTaskFromNote : note,
              ),
            }
          : current,
      );
      invalidateTasks(queryClient, motorcycleId);
    },
  });
}
