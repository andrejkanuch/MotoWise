import { FREE_TIER_LIMITS, type ProFeature } from '@motovault/types';
import { useCallback } from 'react';
import { presentPaywall } from '../lib/subscription';
import { useSubscriptionStore } from '../stores/subscription.store';

type FeatureAccess =
  | { allowed: true; unlimited: true }
  | { allowed: true; unlimited: false; limit: number; remaining: number }
  | { allowed: false; unlimited: false; limit: number; remaining: number };

export function checkFeatureAccess(
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
  /** Check if a counted feature is accessible; returns access info */
  checkAccess: (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number) => FeatureAccess;
  /** Attempt to use a pro-only feature; opens RevenueCat paywall if not pro. Returns true if allowed. */
  requirePro: (feature: ProFeature) => boolean;
  /** Attempt to use a counted feature; opens RevenueCat paywall if limit exceeded. Returns true if allowed. */
  requireAccess: (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number) => boolean;
}

/**
 * Hook for gating premium features. Reads subscription state from Zustand store.
 * Provides helpers to check access and trigger soft paywalls.
 *
 * Usage:
 * ```ts
 * const { requirePro, requireAccess } = useProGate();
 *
 * // For pro-only features (GPX export, offline trips):
 * if (!requirePro('gpx_export')) return; // paywall shown automatically
 *
 * // For counted features (bikes, diagnostics, articles):
 * if (!requireAccess('MAX_BIKES', currentBikeCount)) return; // paywall shown automatically
 * ```
 */
export function useProGate(): ProGateResult {
  const isPro = useSubscriptionStore((s) => s.isPro);
  const isTrialing = useSubscriptionStore((s) => s.isTrialing);

  const checkAccess = useCallback(
    (feature: keyof typeof FREE_TIER_LIMITS, currentCount: number): FeatureAccess => {
      return checkFeatureAccess(feature, currentCount, isPro);
    },
    [isPro],
  );

  const requirePro = useCallback(
    (feature: ProFeature): boolean => {
      if (isPro) return true;
      presentPaywall({
        source: 'feature_gate',
        feature,
        placement: 'feature_gate',
        surface: 'use_pro_gate',
      });
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
        MAX_ARTICLES_PER_MONTH: 'unlimited_articles',
        MAX_RECEIPT_SCANS_PER_MONTH: 'unlimited_scans',
      };
      const proFeature = featureMap[feature] ?? 'unlimited_bikes';
      presentPaywall({
        source: 'feature_gate',
        feature: proFeature,
        placement: 'feature_gate',
        surface: 'use_pro_gate',
        metadata: {
          limit_key: feature,
          current_count: currentCount,
          limit: access.limit,
          remaining: access.remaining,
        },
      });
      return false;
    },
    [isPro],
  );

  return {
    isPro,
    isTrialing,
    checkAccess,
    requirePro,
    requireAccess,
  };
}
