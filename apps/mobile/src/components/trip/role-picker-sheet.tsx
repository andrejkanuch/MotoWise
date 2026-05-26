/**
 * #117 — minimal organiser-only role picker.
 *
 * Shows an ActionSheet (iOS) or Alert (Android) letting the organiser
 * toggle a participant between rider ↔ co_planner. Kept deliberately
 * small — no full-screen modal, just a quick tap-to-change.
 */
import {
  ParticipantRole,
  SetTripParticipantRoleDocument,
  type SetTripParticipantRoleMutation,
} from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback } from 'react';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { showActionSheet } from '../../utils/action-sheet';

const ROLE_LABELS: Record<string, string> = {
  rider: 'Rider',
  co_planner: 'Co-planner',
  organizer: 'Organiser',
};

interface UseRolePickerParams {
  tripId: string;
}

export function useRolePicker({ tripId }: UseRolePickerParams) {
  const qc = useQueryClient();

  const mutation = useMutation<
    SetTripParticipantRoleMutation,
    Error,
    { userId: string; role: ParticipantRole }
  >({
    mutationFn: (vars) =>
      gqlFetcher(SetTripParticipantRoleDocument, {
        input: { tripId, userId: vars.userId, role: vars.role },
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
    },
  });

  const showRolePicker = useCallback(
    (participant: { id: string; displayName: string; role: string }) => {
      // Can't change the organiser's own role
      if (participant.role === 'organizer') return;

      const currentRole = participant.role;
      const targetRole =
        currentRole === 'co_planner' ? ParticipantRole.Rider : ParticipantRole.CoPlanner;
      const targetLabel = ROLE_LABELS[targetRole] ?? targetRole;
      const currentLabel = ROLE_LABELS[currentRole] ?? currentRole;

      const doChange = () => {
        mutation.mutate({ userId: participant.id, role: targetRole });
      };

      showActionSheet(
        participant.displayName,
        [
          { label: `Change to ${targetLabel}`, onPress: doChange },
          { label: 'Cancel', onPress: () => {}, style: 'cancel' },
        ],
        `Currently: ${currentLabel}`,
      );
    },
    [mutation],
  );

  return { showRolePicker, isChangingRole: mutation.isPending };
}
