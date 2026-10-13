import { SendFeedbackDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Updates from 'expo-updates';
import { useTranslation } from 'react-i18next';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import {
  buildSendFeedbackInput,
  currentAppVersion,
  devicePlatform,
  type FeedbackDraft,
} from './feedback-input';

/**
 * Sends one draft through `sendFeedback`. A retry reuses the draft's
 * `clientId`, so a request the server already saved is not saved or emailed
 * twice. The opt-in may have changed, so `me` is refetched on success.
 */
export function useSendFeedback() {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();

  return useMutation({
    mutationFn: (draft: FeedbackDraft) =>
      gqlFetcher(SendFeedbackDocument, {
        input: buildSendFeedbackInput(draft, {
          platform: devicePlatform(process.env.EXPO_OS),
          appVersion: currentAppVersion(),
          updateId: Updates.updateId ?? null,
          locale: i18n.resolvedLanguage ?? i18n.language,
        }),
      }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
  });
}
