import {
  DeleteAccountDocument,
  MyMotorcyclesDocument,
  UpdateUserDocument,
} from '@motovault/graphql';
import { FREE_TIER_LIMITS, REVENUECAT_ENTITLEMENT_PRO } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import type { TFunction } from 'i18next';
import { Alert } from 'react-native';
import { releaseSheetDraftsForSignOut } from '../components/bike-hub/notes/unattached-note-photos';
import { GARAGE_ROUTE } from '../config/routes';
import { gqlFetcher } from '../lib/graphql-client';
import { isAccountAlreadyDeleted, userFriendlyError } from '../lib/graphql-errors';
import { queryKeys } from '../lib/query-keys';
import { meOptions } from '../lib/query-options';
import { presentPaywall } from '../lib/subscription';
import { safeSignOut } from '../lib/supabase';
import { triggerImpact } from '../utils/haptics';

interface UseProfileDataParams {
  t: TFunction;
  isPro: boolean;
}

/** Server-side write of the account-level unit / currency preferences. */
export function useUpdatePreference() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input: { currency?: string; measurementSystem?: string }) =>
      gqlFetcher(UpdateUserDocument, { input }),
    onSuccess: (_data, input) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user.me });
      // A unit change rewrites every bike's distance_unit server-side (00180
      // sync trigger), and the bike hub labels distances from the cached bike.
      if (input.measurementSystem) {
        queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
      }
    },
  });
}

/**
 * The one delete-account flow (two confirmations, then the server delete and a
 * local sign-out). Used by the Profile home and the Privacy screen.
 */
export function useDeleteAccount(t: TFunction) {
  const queryClient = useQueryClient();

  const finishAccountDeletion = async () => {
    await safeSignOut();
    queryClient.clear();
    router.replace('/(auth)/login');
  };

  const deleteMutation = useMutation({
    mutationFn: () => gqlFetcher(DeleteAccountDocument),
    meta: { skipSentryCapture: isAccountAlreadyDeleted },
    onSuccess: finishAccountDeletion,
    onError: (error: Error) => {
      // Account already gone server-side (e.g. a retried deletion) — the desired
      // end state is identical to success, so finish the local sign-out.
      if (isAccountAlreadyDeleted(error)) {
        void finishAccountDeletion();
        return;
      }
      Alert.alert(
        t('privacy.deleteErrorTitle', { defaultValue: 'Deletion Failed' }),
        userFriendlyError(error),
      );
    },
  });

  const confirmDeleteAccount = () => {
    triggerImpact();
    Alert.alert(
      t('privacy.deleteTitle', { defaultValue: 'Delete Account' }),
      t('privacy.deleteWarning', {
        defaultValue:
          'This will permanently delete your account and ALL associated data including motorcycles, maintenance history, diagnostics, and learning progress. Your subscription will be cancelled. You have 30 days to change your mind before data is permanently removed.',
      }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('privacy.deleteConfirmButton', { defaultValue: 'Delete My Account' }),
          style: 'destructive',
          onPress: () => {
            Alert.alert(
              t('privacy.deleteConfirmTitle', { defaultValue: 'Are you absolutely sure?' }),
              t('privacy.deleteConfirmMessage', {
                defaultValue:
                  'This cannot be undone. Type DELETE to confirm is not required, but please be certain.',
              }),
              [
                { text: t('common.cancel'), style: 'cancel' },
                {
                  text: t('privacy.deleteFinal', { defaultValue: 'Yes, Delete Everything' }),
                  style: 'destructive',
                  onPress: () => deleteMutation.mutate(),
                },
              ],
            );
          },
        },
      ],
    );
  };

  return { confirmDeleteAccount, isDeleting: deleteMutation.isPending };
}

export function useProfileData({ t, isPro }: UseProfileDataParams) {
  const meQuery = useQuery(meOptions());
  const user = meQuery.data?.me;

  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = bikesQuery.data?.myMotorcycles ?? [];

  const updatePreferenceMutation = useUpdatePreference();

  const { confirmDeleteAccount, isDeleting } = useDeleteAccount(t);

  const handleAddBike = async () => {
    if (!isPro && motorcycles.length >= FREE_TIER_LIMITS.MAX_BIKES) {
      triggerImpact();
      const result = await presentPaywall({
        requiredEntitlementIdentifier: REVENUECAT_ENTITLEMENT_PRO,
        source: 'profile',
        feature: 'unlimited_bikes',
        surface: 'profile_add_bike',
      });
      if (result !== 'purchased' && result !== 'restored') return;
    }
    triggerImpact();
    router.push(GARAGE_ROUTE.ADD_BIKE);
  };

  const handleLogout = async () => {
    triggerImpact();
    // Needs the session, so before sign-out (the auth listener runs after it).
    await releaseSheetDraftsForSignOut();
    await safeSignOut();
    router.replace('/(auth)/login');
  };

  return {
    user,
    motorcycles,
    updatePreferenceMutation,
    handleAddBike,
    handleLogout,
    handleDeleteAccount: confirmDeleteAccount,
    isDeleting,
  };
}
