import * as Application from 'expo-application';
import { getWhatsNewRelease } from '../data/whats-new-releases';
import { useWhatsNewStore } from '../stores/whats-new.store';

/**
 * Whether the What's New modal is owed for the installed version: it has a
 * release entry with slides for this platform and the rider has not seen it.
 */
export function isWhatsNewOwed(
  currentVersion: string | null | undefined,
  lastSeenVersion: string | null,
): boolean {
  if (!currentVersion || currentVersion === lastSeenVersion) return false;
  return getWhatsNewRelease(currentVersion) !== null;
}

/**
 * A rider finishing onboarding has just installed this version, so "what's new"
 * means nothing to them: mark it seen. Called from the start of personalizing's
 * setup run, which every onboarding completion (payoff CTA, garage_first
 * paywall, Skip/retry escape, cold-start resume) goes through, and which runs
 * before `onboardingCompleted` can flip and land the rider in (tabs) — the root
 * trigger reads `lastSeenVersion` from the store, so writing it first suffices.
 * Riders updating from an older version never pass through onboarding.
 */
export function markWhatsNewSeenForNewRider(): void {
  const version = Application.nativeApplicationVersion;
  if (version) useWhatsNewStore.getState().setLastSeenVersion(version);
}
