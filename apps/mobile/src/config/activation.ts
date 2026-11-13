/**
 * issue 365 activation release marker level, sent on every PostHog event as
 * `activation_fix_level` (lib/analytics-release-marker.ts).
 *
 * Bump ONLY in the commit that cuts a store build or a crash/data-loss hotfix OTA
 * publish (docs/research/activation-365/EXECUTION_PLAN.md §3A.0 rule 2). Never in a
 * feature PR. The plan's §6.1 status table is the only record of which level ships
 * which fix.
 *
 * 0 = pre-release JS (dev and E2E builds). The Release A cut (3.29.0) sets 2; level 1
 * is not used.
 */
export const ACTIVATION_FIX_LEVEL = 0 as const;
