import * as Application from 'expo-application';
import {
  CATCH_UP_FEATURES,
  WHATS_NEW_FEATURES,
  WHATS_NEW_RELEASES,
  WHATS_NEW_TAG,
  type WhatsNewFeature,
  type WhatsNewRelease,
  type WhatsNewTag,
} from '../data/whats-new-releases';
import { useWhatsNewStore } from '../stores/whats-new.store';
import { compareVersions } from './version-compare';

/** Most pages one What's New visit shows. */
export const WHATS_NEW_MAX_PAGES = 3;

/** What the rider has already been shown or used, which decides the catch-up pages. */
export interface WhatsNewFeatureState {
  seenFeatures: readonly WhatsNewFeature[];
  usedFeatures: readonly WhatsNewFeature[];
}

export interface WhatsNewPage {
  feature: WhatsNewFeature;
  tag: WhatsNewTag;
}

export interface OwedWhatsNew {
  release: WhatsNewRelease;
  pages: WhatsNewPage[];
}

const NOTHING_SEEN: WhatsNewFeatureState = { seenFeatures: [], usedFeatures: [] };

const isAtOrBelow = (version: string, ceiling: string) => {
  const order = compareVersions(version, ceiling);
  return order !== null && order <= 0;
};

/**
 * The pages for `release`: its own features tagged new, then catch-up features
 * that shipped no later than it and that the rider has neither been shown in a
 * carousel nor used, capped at WHATS_NEW_MAX_PAGES.
 */
export function selectPages(release: WhatsNewRelease, state: WhatsNewFeatureState): WhatsNewPage[] {
  const current = [...new Set(release.features)];
  const catchUp = CATCH_UP_FEATURES.filter(
    (feature) =>
      !current.includes(feature) &&
      !state.seenFeatures.includes(feature) &&
      !state.usedFeatures.includes(feature) &&
      isAtOrBelow(WHATS_NEW_FEATURES[feature].introducedIn, release.version),
  );
  return [
    ...current.map((feature) => ({ feature, tag: WHATS_NEW_TAG.NEW })),
    ...catchUp.map((feature) => ({ feature, tag: WHATS_NEW_TAG.CATCH_UP })),
  ].slice(0, WHATS_NEW_MAX_PAGES);
}

/** The newest release entry at or below `version`, or null when there is none or the version is junk. */
export function releaseForVersion(
  version: string | null | undefined,
  releases: readonly WhatsNewRelease[] = WHATS_NEW_RELEASES,
): WhatsNewRelease | null {
  if (!version) return null;
  let best: WhatsNewRelease | null = null;
  for (const release of releases) {
    if (!isAtOrBelow(release.version, version)) continue;
    if (!best || compareVersions(release.version, best.version) === 1) best = release;
  }
  return best;
}

/**
 * The release What's New owes on this build: the newest entry at or below the
 * installed version, when it is newer than the last-seen release (or nothing was
 * seen yet) and has at least one page. Versions that do not parse owe nothing.
 */
export function owedRelease(
  installedVersion: string | null | undefined,
  lastSeenVersion: string | null,
  state: WhatsNewFeatureState,
  releases: readonly WhatsNewRelease[] = WHATS_NEW_RELEASES,
): OwedWhatsNew | null {
  const release = releaseForVersion(installedVersion, releases);
  if (!release) return null;
  if (lastSeenVersion !== null && compareVersions(release.version, lastSeenVersion) !== 1) {
    return null;
  }
  const pages = selectPages(release, state);
  return pages.length > 0 ? { release, pages } : null;
}

/**
 * Whether What's New is owed for the installed build. Called with two
 * arguments, it judges as if the rider had seen and used no feature yet.
 */
export function isWhatsNewOwed(
  currentVersion: string | null | undefined,
  lastSeenVersion: string | null,
  state: WhatsNewFeatureState = NOTHING_SEEN,
): boolean {
  return owedRelease(currentVersion, lastSeenVersion, state) !== null;
}

/**
 * A rider finishing onboarding has just installed this version, so "what's new"
 * means nothing to them: mark it, and the features of the release it carries,
 * seen. Called from the start of personalizing's setup run, which every
 * onboarding completion (payoff CTA, garage_first paywall, Skip/retry escape,
 * cold-start resume) goes through, and which runs before `onboardingCompleted`
 * can flip and land the rider in (tabs). The root trigger reads
 * `lastSeenVersion` from the store, so writing it first suffices. Riders
 * updating from an older version never pass through onboarding.
 */
export function markWhatsNewSeenForNewRider(): void {
  const version = Application.nativeApplicationVersion;
  if (!version) return;
  const features = releaseForVersion(version)?.features ?? [];
  useWhatsNewStore.getState().markReleaseSeen(version, features);
}
