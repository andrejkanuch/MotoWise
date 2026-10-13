import {
  buildFeedbackContact,
  FEEDBACK_CONTACT_SOURCE,
  type SendFeedbackInput,
  UserPreferencesSchema,
} from '@motovault/types';
import type { TablesInsert } from '@motovault/types/database';
import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { PG_ERROR } from '../../common/supabase/unwrap';
import {
  type EmailSendResult,
  EmailService,
  type FeedbackNotification,
} from '../email/email.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { UsersService } from '../users/users.service';

const FEEDBACK_TABLE = 'feedback_messages';
/** Matches the email_error CHECK in 00190. */
const EMAIL_ERROR_MAX_LENGTH = 2000;

interface LatestBikeRow {
  id: string;
  make: string;
  model: string;
  year: number;
  nickname: string | null;
}

interface AccountRow {
  email: string | null;
  preferences: unknown;
}

function formatBikeName(bike: LatestBikeRow | null): string | null {
  if (!bike) return null;
  const name = `${bike.year} ${bike.make} ${bike.model}`;
  return bike.nickname ? `${bike.nickname} (${name})` : name;
}

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly emailService: EmailService,
    private readonly usersService: UsersService,
  ) {}

  /**
   * Saves the message (user client, INSERT-only RLS), saves a changed contact
   * opt-in, and returns. The support-inbox email runs after the response; its
   * outcome lands in emailed_at / email_error. A retry with the same clientId
   * hits the UNIQUE (user_id, client_id) key and returns true without a second
   * email.
   */
  async sendFeedback(user: AuthUser, input: SendFeedbackInput): Promise<boolean> {
    const [account, bike] = await Promise.all([
      this.loadAccount(user.id),
      this.loadLatestBike(user.id),
    ]);

    const contactEmail = input.contactOptIn
      ? (input.contactEmail ?? (user.email || account.email || null))
      : null;

    const row: TablesInsert<'feedback_messages'> = {
      user_id: user.id,
      client_id: input.clientId,
      message: input.message,
      quick_pick: input.quickPick ?? null,
      platform: input.platform,
      app_version: input.appVersion,
      update_id: input.updateId ?? null,
      locale: input.locale,
      motorcycle_id: bike?.id ?? null,
      contact_allowed: input.contactOptIn,
      contact_email: contactEmail,
    };

    // No .select(): riders have no SELECT grant on this table (return=minimal).
    const { error } = await this.supabase.from(FEEDBACK_TABLE).insert(row);
    if (error?.code === PG_ERROR.UNIQUE_VIOLATION) {
      this.logger.log(`sendFeedback: duplicate clientId ${input.clientId} for ${user.id}, skipped`);
      return true;
    }
    if (error) {
      this.logger.error(`sendFeedback insert failed for ${user.id}: ${JSON.stringify(error)}`);
      throw new InternalServerErrorException('Failed to send feedback', {
        cause: new Error(`${error.code}: ${error.message}`),
      });
    }

    await this.saveContactChoice(user.id, account.preferences, input);

    this.emailSupport(user.id, input.clientId, {
      userId: user.id,
      message: input.message,
      quickPick: input.quickPick,
      platform: input.platform,
      appVersion: input.appVersion,
      updateId: input.updateId ?? null,
      locale: input.locale,
      bikeName: formatBikeName(bike),
      contactEmail,
    }).catch((err: unknown) => {
      // emailSupport records its own failures; this only catches a bug in it.
      this.logger.error(`sendFeedback email task crashed for ${user.id}: ${String(err)}`);
      Sentry.captureException(err);
    });

    return true;
  }

  /** Admin read: users.email and preferences are outside the authenticated column grants (00141). */
  private async loadAccount(userId: string): Promise<AccountRow> {
    const { data, error } = await this.supabaseAdmin
      .from('users')
      .select('email, preferences')
      .eq('id', userId)
      .single();
    if (error || !data) {
      this.logger.error(`sendFeedback account read failed for ${userId}: ${JSON.stringify(error)}`);
      throw new InternalServerErrorException('Failed to send feedback');
    }
    return data as AccountRow;
  }

  /** The rider's most recently updated live bike (user client, RLS). Context only: never fails the send. */
  private async loadLatestBike(userId: string): Promise<LatestBikeRow | null> {
    const { data, error } = await this.supabase
      .from('motorcycles')
      .select('id, make, model, year, nickname')
      .eq('user_id', userId)
      .is('deleted_at', null)
      .order('updated_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    if (error) {
      this.logger.warn(`sendFeedback bike read failed for ${userId}: ${error.message}`);
      return null;
    }
    return (data as LatestBikeRow | null) ?? null;
  }

  /**
   * Writes preferences.feedbackContact only when `enabled` or `email` changed.
   * The message is already saved, so a failure here is reported, not thrown: a
   * thrown error would make the app retry, the retry would hit the duplicate
   * key, and the email would never be sent.
   */
  private async saveContactChoice(
    userId: string,
    storedPreferences: unknown,
    input: SendFeedbackInput,
  ): Promise<void> {
    const parsed = UserPreferencesSchema.safeParse(storedPreferences ?? {});
    const stored = parsed.success ? parsed.data.feedbackContact : undefined;
    // The form sends contactEmail only while the rider opts in, so an opted-out
    // send keeps whatever address is stored rather than erasing it.
    const email = input.contactOptIn ? (input.contactEmail ?? null) : (stored?.email ?? null);
    const unchanged =
      (stored?.enabled ?? false) === input.contactOptIn && (stored?.email ?? null) === email;
    if (unchanged) return;

    const feedbackContact = buildFeedbackContact({
      enabled: input.contactOptIn,
      email,
      wordingVersion: input.contactWordingVersion,
      locale: input.locale,
      source: FEEDBACK_CONTACT_SOURCE.FORM,
    });
    try {
      await this.usersService.update(userId, { preferences: { feedbackContact } });
    } catch (err) {
      this.logger.error(`sendFeedback contact opt-in save failed for ${userId}: ${String(err)}`);
      Sentry.captureException(err);
    }
  }

  private async emailSupport(
    userId: string,
    clientId: string,
    feedback: FeedbackNotification,
  ): Promise<void> {
    let result: EmailSendResult;
    try {
      result = await this.emailService.sendFeedbackNotification(feedback);
    } catch (err) {
      result = { ok: false, error: err instanceof Error ? err.message : String(err) };
    }

    const outcome = result.ok
      ? { emailed_at: new Date().toISOString() }
      : { email_error: (result.error ?? 'Unknown error').slice(0, EMAIL_ERROR_MAX_LENGTH) };

    if (!result.ok) {
      this.logger.error(`Feedback email failed for ${userId} (${clientId}): ${result.error}`);
      Sentry.captureMessage(`Feedback email failed: ${result.error}`, 'error');
    }

    // Admin client: emailed_at / email_error are service-role-only columns.
    const { error } = await this.supabaseAdmin
      .from(FEEDBACK_TABLE)
      .update(outcome)
      .eq('user_id', userId)
      .eq('client_id', clientId);
    if (error) {
      this.logger.error(
        `Feedback email outcome not recorded for ${userId} (${clientId}): ${error.message}`,
      );
    }
  }
}
