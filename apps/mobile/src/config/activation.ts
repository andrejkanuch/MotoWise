/**
 * issue 365 activation release marker level, sent on every PostHog event as
 * `activation_fix_level` (lib/analytics-release-marker.ts).
 *
 * Bump ONLY in the commit that cuts a store build or a crash/data-loss hotfix OTA
 * publish (docs/research/activation-365/EXECUTION_PLAN.md §3A.0 rule 2). Never in a
 * feature PR. The plan's §6.1 status table is the only record of which level ships
 * which fix.
 *
 * 0 = pre-release JS (before the Release A cut). 2 = Release A (3.29.0, set by its cut
 * commit); level 1 is not used. Release B (3.30.0) sets 3. Dev and E2E builds of a
 * commit carry that commit's level; every issue 365 metric drops E2E events by `e2e_run`.
 */
export const ACTIVATION_FIX_LEVEL = 2 as const;
