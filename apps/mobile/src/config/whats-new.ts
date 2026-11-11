/**
 * Timings and the holdout experiment for What's New.
 *
 * The boot is a deliberate exception to the "animations under 300 ms" rule:
 * it runs once per store update, any tap skips it, and reduced motion shows a
 * static frame instead.
 */
export const WHATS_NEW_TIMING = {
  /** Length of the instrument boot before the pages appear. */
  BOOT_DURATION_MS: 2000,
  /** Delay between the gate deciding to show and the modal opening. */
  SHOW_DELAY_MS: 500,
  /** Budget for fetching the rider's expenses and notes when What's New opens. */
  DATA_FETCH_TIMEOUT_MS: 1500,
  /**
   * How long a What's New button ignores a second press. Also released when the
   * screen regains focus; the delay covers a press that opens no route (a native
   * paywall), which never changes focus.
   */
  TAP_LATCH_MS: 1000,
} as const;

/** Smallest press target on What's New and its way back, in points. */
export const WHATS_NEW_MIN_TARGET = 44;

export const WHATS_NEW_ARM = {
  TREATMENT: 'treatment',
  HOLDOUT: 'holdout',
} as const;

export type WhatsNewArm = (typeof WHATS_NEW_ARM)[keyof typeof WHATS_NEW_ARM];

/** Where an arm came from: a real PostHog variant, or the show-by-default fallback. */
export const WHATS_NEW_ARM_SOURCE = {
  POSTHOG: 'posthog',
  FALLBACK: 'fallback',
} as const;

export type WhatsNewArmSource = (typeof WHATS_NEW_ARM_SOURCE)[keyof typeof WHATS_NEW_ARM_SOURCE];

/**
 * 50/50 holdout on the auto-show. Only riders PostHog actually assigns are held
 * out and remembered; when PostHog cannot be asked, or the flag is missing or
 * disabled, the rider gets What's New and nothing is stored. Without the flag
 * created in PostHog, nobody is held out.
 */
export const WHATS_NEW_EXPERIMENT = {
  FLAG_KEY: 'whats_new_holdout_2026q4',
  EXPERIMENT_KEY: 'whats_new_holdout_2026q4',
  /** After this instant everyone gets What's New and PostHog is not asked. */
  ENDS_AT: '2027-03-31T00:00:00Z',
  FLAG_FETCH_TIMEOUT_MS: 2000,
} as const;

/** How What's New was opened. */
export const WHATS_NEW_SOURCE = {
  AUTO: 'auto',
  PROFILE: 'profile',
  RETURN: 'return',
} as const;

export type WhatsNewSource = (typeof WHATS_NEW_SOURCE)[keyof typeof WHATS_NEW_SOURCE];
