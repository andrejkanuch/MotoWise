import { z } from 'zod';
import {
  FEEDBACK_CONTACT_EMAIL_MAX_LENGTH,
  FEEDBACK_CONTACT_SOURCE,
  FEEDBACK_MESSAGE_MAX_LENGTH,
  FEEDBACK_QUICK_PICK,
} from '../constants/feedback';
import { nullishToUndefined } from './nullish';
import { DEVICE_PLATFORM } from './push-token';

/** No CR or LF anywhere: the contact email is sent as a Reply-To header. */
const NO_LINE_BREAKS = /^[^\r\n]*$/;

/** Counts code points, like Postgres char_length(), not UTF-16 units. */
const codePointLength = (value: string) => [...value].length;

export const FeedbackContactEmailSchema = z
  .string()
  .regex(NO_LINE_BREAKS, 'Email must not contain line breaks')
  .trim()
  .max(FEEDBACK_CONTACT_EMAIL_MAX_LENGTH)
  .email();
export type FeedbackContactEmail = z.infer<typeof FeedbackContactEmailSchema>;

export const FeedbackQuickPickSchema = z.enum([
  FEEDBACK_QUICK_PICK.LOVE,
  FEEDBACK_QUICK_PICK.WISH,
  FEEDBACK_QUICK_PICK.BROKEN,
]);

export const FeedbackContactSourceSchema = z.enum([
  FEEDBACK_CONTACT_SOURCE.FORM,
  FEEDBACK_CONTACT_SOURCE.NOTIFICATIONS,
  FEEDBACK_CONTACT_SOURCE.ONBOARDING,
]);

/** App locale the opt-in text was shown in (an app language tag such as `en` or `pt-BR`). */
export const FeedbackLocaleSchema = z.string().trim().min(2).max(35);

export const FeedbackWordingVersionSchema = z.number().int().min(1);

/**
 * users.preferences.feedbackContact — the rider's single contact opt-in choice.
 * `email: null` means "use the account email", so a later login-email change
 * never leaves a stale copy behind.
 */
export const FeedbackContactSchema = z.object({
  enabled: z.boolean(),
  email: FeedbackContactEmailSchema.nullable(),
  decidedAt: z.string().datetime(),
  wordingVersion: FeedbackWordingVersionSchema,
  locale: FeedbackLocaleSchema,
  source: FeedbackContactSourceSchema,
});
export type FeedbackContact = z.infer<typeof FeedbackContactSchema>;

/** Builds the whole `feedbackContact` object every writer must send, stamping `decidedAt`. */
export function buildFeedbackContact({
  now = new Date(),
  ...choice
}: Omit<FeedbackContact, 'decidedAt'> & { now?: Date }): FeedbackContact {
  return { ...choice, decidedAt: now.toISOString() };
}

export const SendFeedbackInputSchema = z.object({
  /** Client-generated per draft; reused across retries so a retried insert is a no-op. */
  clientId: z.string().uuid(),
  message: z
    .string()
    .trim()
    .min(1)
    .refine((value) => codePointLength(value) <= FEEDBACK_MESSAGE_MAX_LENGTH, {
      message: `Message must be at most ${FEEDBACK_MESSAGE_MAX_LENGTH} characters`,
    }),
  quickPick: nullishToUndefined(FeedbackQuickPickSchema),
  platform: z.enum([DEVICE_PLATFORM.IOS, DEVICE_PLATFORM.ANDROID]),
  appVersion: z.string().trim().min(1).max(32),
  /** expo-updates update id; absent in development builds. */
  updateId: nullishToUndefined(z.string().trim().min(1).max(64)),
  locale: FeedbackLocaleSchema,
  contactOptIn: z.boolean(),
  /** Rider-chosen contact email; absent/null = use the account email. */
  contactEmail: nullishToUndefined(FeedbackContactEmailSchema),
  contactWordingVersion: FeedbackWordingVersionSchema,
});
export type SendFeedbackInput = z.infer<typeof SendFeedbackInputSchema>;
