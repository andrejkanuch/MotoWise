import { UpdateUserDocument } from '@motovault/graphql';
import { FEEDBACK_CONTACT_SOURCE, type FeedbackContact } from '@motovault/types';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { AnalyticsEvent, trackEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { queryKeys } from '@/lib/query-keys';
import { meOptions } from '@/lib/query-options';
import { buildFeedbackContact, readFeedbackContact } from './contact-email';

/**
 * The contact opt-in as Notifications edits it. Every write sends the whole
 * `feedbackContact` object (the server validates it as one), built on the last
 * value sent rather than the possibly stale `me` cache, so two quick changes
 * never drop each other's field.
 */
export function useFeedbackContactPreference() {
  const queryClient = useQueryClient();
  const { i18n } = useTranslation();
  const meQuery = useQuery(meOptions());
  const accountEmail = meQuery.data?.me?.email ?? null;
  const stored = readFeedbackContact(meQuery.data?.me?.preferences);

  const lastSentRef = useRef<FeedbackContact | null>(null);
  /** Writes run one after another so the server always ends on the rider's latest choice. */
  const writeQueueRef = useRef<Promise<unknown>>(Promise.resolve());
  /** The toggle as the rider last set it; null = show the stored value. */
  const [enabledOverride, setEnabledOverride] = useState<boolean | null>(null);

  const mutation = useMutation({
    mutationFn: (feedbackContact: FeedbackContact) =>
      gqlFetcher(UpdateUserDocument, { input: { preferences: { feedbackContact } } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: queryKeys.user.me }),
  });

  const current = lastSentRef.current ?? stored;

  /** Saves one change; resolves false (and rolls the base back) when the write fails. */
  const save = async (change: { enabled?: boolean; email?: string | null }): Promise<boolean> => {
    const previous = lastSentRef.current;
    const base = previous ?? stored;
    const next = buildFeedbackContact({
      enabled: change.enabled ?? base?.enabled ?? false,
      email: change.email !== undefined ? change.email : (base?.email ?? null),
      locale: i18n.resolvedLanguage ?? i18n.language,
      source: FEEDBACK_CONTACT_SOURCE.NOTIFICATIONS,
    });
    lastSentRef.current = next;
    const write = writeQueueRef.current.then(() => mutation.mutateAsync(next));
    writeQueueRef.current = write.catch(() => undefined);
    try {
      await write;
      return true;
    } catch {
      if (lastSentRef.current === next) lastSentRef.current = previous;
      return false;
    }
  };

  const setEnabled = async (enabled: boolean): Promise<boolean> => {
    const before = enabledOverride ?? current?.enabled ?? false;
    setEnabledOverride(enabled);
    const ok = await save({ enabled });
    if (!ok) {
      setEnabledOverride(before);
      return false;
    }
    trackEvent(AnalyticsEvent.FEEDBACK_CONTACT_OPT_IN_CHANGED, {
      enabled,
      source: FEEDBACK_CONTACT_SOURCE.NOTIFICATIONS,
    });
    return true;
  };

  return {
    isLoaded: !!meQuery.data?.me,
    accountEmail,
    enabled: enabledOverride ?? current?.enabled ?? false,
    /** The rider's chosen address; null = the account email is used. */
    email: current?.email ?? null,
    setEnabled,
    setEmail: (email: string | null) => save({ email }),
  };
}
