import { FREE_TIER_LIMITS, type ProFeature } from '@motovault/types';
import { useCallback, useState } from 'react';
import { useSubscriptionStore } from '../stores/subscription.store';

type FeatureAccess =
  | { allowed: true; unlimited: true }
  | { allowed: true; unlimited: false; limit: number; remaining: number }
  | { allowed: false; unlimited: false; limit: number; remaining: number };

function checkFeatureAccess(
  feature: keyof typeof FREE_TIER_LIMITS,
  currentCount: number,
  isPro: boolean,
): FeatureAccess {
  if (isPro) return { allowed: true, unlimited: true };
  const limit = FREE_TIER_LIMITS[feature];
  const remaining = Math.max(0, limit - currentCount);
  return {
    allowed: currentCount < limit,
    unlimited: false,
    limit,
    remaining,
  };
}

interface ProGateResult {
  isPro: boolean;
  isTrialing: boolean;
  /** Whether the paywall modal is currently visible */
  showPaywall: boolean;
  /** The feature that triggered the paywall */
  blockedFeature: ProFeature | null;
  /** Check if a counted feature is accessible; returns access info */
  checkAccess: (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number) => FeatureAccess;
  /** Attempt to use a pro-only feature; shows paywall if not pro. Returns true if allowed. */
  requirePro: (feature: ProFeature) => boolean;
  /** Attempt to use a counted feature; shows paywall if limit exceeded. Returns true if allowed. */
  requireAccess: (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number) => boolean;
  /** Dismiss the paywall modal */
  dismissPaywall: () => void;
}

/**
 * Hook for gating premium features. Reads subscription state from Zustand store.
 * Provides helpers to check access and trigger soft paywalls.
 *
 * Usage:
 * ```ts
 * const { requirePro, requireAccess, showPaywall, dismissPaywall, blockedFeature } = useProGate();
 *
 * // For pro-only features (maintenance reminders, PDF export):
 * if (!requirePro('maintenance_reminders')) return; // paywall shown automatically
 *
 * // For counted features (bikes, diagnostics, articles):
 * if (!requireAccess('MAX_BIKES', currentBikeCount)) return; // paywall shown automatically
 * ```
 */
export function useProGate(): ProGateResult {
  const isPro = useSubscriptionStore((s) => s.isPro);
  const isTrialing = useSubscriptionStore((s) => s.isTrialing);
  const [showPaywall, setShowPaywall] = useState(false);
  const [blockedFeature, setBlockedFeature] = useState<ProFeature | null>(null);

  const checkAccess = useCallback(
    (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number): FeatureAccess => {
      return checkFeatureAccess(feature, currentCount, isPro);
    },
    [isPro],
  );

  const requirePro = useCallback(
    (feature: ProFeature): boolean => {
      if (isPro) return true;
      setBlockedFeature(feature);
      setShowPaywall(true);
      return false;
    },
    [isPro],
  );

  const requireAccess = useCallback(
    (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number): boolean => {
      const access = checkFeatureAccess(feature, currentCount, isPro);
      if (access.allowed) return true;
      // Map the limit key to a ProFeature for the paywall context
      const featureMap: Partial<Record<keyof typeof FREE_TIER_LIMITS, ProFeature>> = {
        MAX_BIKES: 'unlimited_bikes',
        MAX_AI_DIAGNOSTICS_PER_MONTH: 'full_ai_diagnostics',
        MAX_ARTICLES_PER_WEEK: 'unlimited_articles',
        MAX_MAINTENANCE_TASKS_PER_BIKE: 'maintenance_reminders',
      };
      setBlockedFeature(featureMap[feature] ?? 'unlimited_bikes');
      setShowPaywall(true);
      return false;
    },
    [isPro],
  );

  const dismissPaywall = useCallback(() => {
    setShowPaywall(false);
    setBlockedFeature(null);
  }, []);

  return {
    isPro,
    isTrialing,
    showPaywall,
    blockedFeature,
    checkAccess,
    requirePro,
    requireAccess,
    dismissPaywall,
  };
}
