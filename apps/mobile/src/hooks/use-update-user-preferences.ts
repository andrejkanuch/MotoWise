import { type MeQuery, UpdateUserDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { useCallback } from 'react';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import {
  buildUpdateInput,
  hasRootFields,
  type UpdateInput,
  type UserPreferencesPatch,
} from './build-update-input';

export type { UserPreferencesPatch } from './build-update-input';

type MutateArgs = {
  input: UpdateInput;
  snapshot: MeQuery | undefined;
};

type Context = { snapshot: MeQuery | undefined };

export function useUpdateUserPreferences(): {
  update: (patch: UserPreferencesPatch) => void;
  isPending: boolean;
  isError: boolean;
  error: Error | null;
} {
  const queryClient = useQueryClient();

  const mutation = useMutation<unknown, Error, MutateArgs, Context>({
    mutationFn: ({ input }) => gqlFetcher(UpdateUserDocument, { input }),
    onMutate: ({ snapshot }) => ({ snapshot }),
    onError: (_error, _vars, context) => {
      if (context?.snapshot !== undefined) {
        queryClient.setQueryData(queryKeys.user.me, context.snapshot);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  const update = useCallback(
    (patch: UserPreferencesPatch) => {
      const snapshot = queryClient.getQueryData<MeQuery>(queryKeys.user.me);
      const currentPrefs =
        (snapshot?.me?.preferences as Record<string, unknown> | null | undefined) ?? undefined;

      const input = buildUpdateInput(patch, currentPrefs);
      const mergedPreferences = input.preferences;

      // Optimistic update: write the merged result to cache BEFORE the mutation resolves.
      // This guarantees two things:
      //   1. UI bound to MeQuery reflects the change immediately.
      //   2. A rapid follow-up update() sees the latest merged state (not the pre-first snapshot),
      //      so sibling blocks from the first call are not clobbered by the second.
      if (snapshot !== undefined && (mergedPreferences !== undefined || hasRootFields(patch))) {
        const nextMe: MeQuery['me'] = { ...snapshot.me };
        if (mergedPreferences !== undefined) {
          nextMe.preferences = mergedPreferences;
        }
        if (patch.fullName !== undefined) nextMe.fullName = patch.fullName;
        if (patch.measurementSystem !== undefined) {
          nextMe.measurementSystem = patch.measurementSystem;
        }
        if (patch.currency !== undefined) nextMe.currency = patch.currency;
        queryClient.setQueryData<MeQuery>(queryKeys.user.me, { ...snapshot, me: nextMe });
      }

      mutation.mutate({ input, snapshot });
    },
    [mutation, queryClient],
  );

  return {
    update,
    isPending: mutation.isPending,
    isError: mutation.isError,
    error: mutation.error,
  };
}
