/**
 * "Write to the developer" feedback and the rider's contact opt-in.
 * Shared by the API (sendFeedback, completeOnboarding) and the mobile form,
 * Notifications screen and onboarding notifications step.
 */

/** Optional quick pick shown above the free-text message. Stored in feedback_messages.quick_pick. */
export const FEEDBACK_QUICK_PICK = {
  LOVE: 'love',
  WISH: 'wish',
  BROKEN: 'broken',
} as const;
export type FeedbackQuickPick = (typeof FEEDBACK_QUICK_PICK)[keyof typeof FEEDBACK_QUICK_PICK];

/** Where the rider made their contact opt-in choice (users.preferences.feedbackContact.source). */
export const FEEDBACK_CONTACT_SOURCE = {
  FORM: 'form',
  NOTIFICATIONS: 'notifications',
  ONBOARDING: 'onboarding',
} as const;
export type FeedbackContactSource =
  (typeof FEEDBACK_CONTACT_SOURCE)[keyof typeof FEEDBACK_CONTACT_SOURCE];

/**
 * Version of the "the developer may contact me about my feedback" wording.
 * Bump it whenever ANY locale's opt-in text changes on any surface; the stored
 * `locale` + `source` then identify exactly which text the rider saw.
 */
export const FEEDBACK_CONTACT_WORDING_VERSION = 1;

/** Max message length in characters (code points). Matches the DB CHECK in 00190. */
export const FEEDBACK_MESSAGE_MAX_LENGTH = 4000;

/** RFC 5321 path limit; the contact email becomes a Reply-To header. */
export const FEEDBACK_CONTACT_EMAIL_MAX_LENGTH = 254;
