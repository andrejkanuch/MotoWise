import { type DevicePlatform, FEEDBACK_QUICK_PICK, type FeedbackQuickPick } from '@motovault/types';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const FROM_ADDRESS = 'MotoVault <noreply@motovault.app>';
const DEFAULT_NOTIFY_EMAIL = 'support@motovault.app';
const DRY_RUN_ERROR = 'RESEND_API_KEY not configured (dry run, not sent)';

/** Outcome of one send. Callers that only fire-and-forget may ignore it. */
export interface EmailSendResult {
  ok: boolean;
  error?: string;
}

export interface EmailSendOptions {
  replyTo?: string;
}

/** A rider's "Write to the developer" message, as emailed to the support inbox. */
export interface FeedbackNotification {
  userId: string;
  message: string;
  quickPick?: FeedbackQuickPick;
  platform: DevicePlatform;
  appVersion: string;
  updateId?: string | null;
  locale: string;
  bikeName: string | null;
  /** Effective address the rider allowed replies to; null = no contact consent. */
  contactEmail: string | null;
}

/** Subject labels: app constants only, never rider text. */
const FEEDBACK_SUBJECT_LABEL: Record<FeedbackQuickPick, string> = {
  [FEEDBACK_QUICK_PICK.LOVE]: 'I love…',
  [FEEDBACK_QUICK_PICK.WISH]: 'I wish…',
  [FEEDBACK_QUICK_PICK.BROKEN]: "Something's broken",
};
const FEEDBACK_SUBJECT_NO_PICK = 'Message';
const NOT_PROVIDED = '—';

const EMAIL_COLORS = {
  HEADING: '#0F172A',
  BODY: '#475569',
  MUTED: '#94A3B8',
  HIGHLIGHT_BG: '#F1F5F9',
  BUTTON_GRADIENT_START: '#6366F1',
  BUTTON_GRADIENT_END: '#818CF8',
  BUTTON_TEXT: '#FFFFFF',
} as const;

const HTML_ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
};

/** Escape user-controlled values before interpolating them into email HTML. */
function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => HTML_ESCAPES[char]);
}

/** Shared wrapper + heading markup for all transactional emails. */
function renderEmailLayout({ title, bodyHtml }: { title: string; bodyHtml: string }): string {
  return `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: ${EMAIL_COLORS.HEADING}; margin-bottom: 16px;">
          ${title}
        </h1>
        ${bodyHtml}
      </div>
    `;
}

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private readonly resend: Resend | null;

  constructor(private readonly config: ConfigService) {
    const apiKey = this.config.get<string>('RESEND_API_KEY');
    this.resend = apiKey ? new Resend(apiKey) : null;

    if (!this.resend) {
      this.logger.warn('RESEND_API_KEY not configured — emails will be logged only');
    }
  }

  async sendDataExportReady(email: string, downloadUrl: string): Promise<void> {
    const subject = 'Your MotoVault data export is ready';
    const html = renderEmailLayout({
      title: 'Your data export is ready',
      bodyHtml: `
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 24px;">
          We've compiled all your MotoVault data. Click the button below to download your export file.
          This link will expire in 7 days.
        </p>
        <a href="${escapeHtml(downloadUrl)}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, ${EMAIL_COLORS.BUTTON_GRADIENT_START}, ${EMAIL_COLORS.BUTTON_GRADIENT_END}); color: ${EMAIL_COLORS.BUTTON_TEXT}; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 12px;">
          Download Your Data
        </a>
        <p style="font-size: 13px; color: ${EMAIL_COLORS.MUTED}; margin-top: 32px; line-height: 1.5;">
          If you didn't request this export, you can safely ignore this email.
          For questions, contact us at support@motovault.app.
        </p>
      `,
    });

    await this.send(email, subject, html);
  }

  /**
   * Emails a rider's feedback message to the support inbox. Every rider value is
   * escaped; the subject carries only the quick-pick label. Reply-To is set only
   * when the rider allowed contact.
   */
  async sendFeedbackNotification(feedback: FeedbackNotification): Promise<EmailSendResult> {
    const notifyEmail = this.config.get<string>('NOTIFY_EMAIL') ?? DEFAULT_NOTIFY_EMAIL;
    const label = feedback.quickPick
      ? FEEDBACK_SUBJECT_LABEL[feedback.quickPick]
      : FEEDBACK_SUBJECT_NO_PICK;
    const subject = `MotoVault feedback: ${label}`;

    const contextRows: Array<[string, string]> = [
      ['App version', feedback.appVersion],
      ['Update', feedback.updateId ?? NOT_PROVIDED],
      ['Platform', feedback.platform],
      ['Locale', feedback.locale],
      ['Bike', feedback.bikeName ?? NOT_PROVIDED],
      ['User id', feedback.userId],
    ];
    const contextHtml = contextRows
      .map(
        ([name, value]) =>
          `<tr><td style="padding: 4px 12px 4px 0; color: ${EMAIL_COLORS.MUTED};">${name}</td><td style="padding: 4px 0; color: ${EMAIL_COLORS.HEADING};">${escapeHtml(value)}</td></tr>`,
      )
      .join('');
    const contactHtml = feedback.contactEmail
      ? `The rider allows contact about this feedback. Reply to this email to reach them at <strong>${escapeHtml(feedback.contactEmail)}</strong>.`
      : 'The rider did not opt in to contact. Do not reply; identify them only by the user id above.';

    const html = renderEmailLayout({
      title: escapeHtml(label),
      bodyHtml: `
        <p style="font-size: 15px; color: ${EMAIL_COLORS.HEADING}; background: ${EMAIL_COLORS.HIGHLIGHT_BG}; padding: 12px 16px; border-radius: 8px; line-height: 1.6; white-space: pre-wrap;">${escapeHtml(feedback.message)}</p>
        <table style="font-size: 13px; margin: 16px 0; border-collapse: collapse;">${contextHtml}</table>
        <p style="font-size: 14px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6;">${contactHtml}</p>
      `,
    });

    return this.send(notifyEmail, subject, html, {
      replyTo: feedback.contactEmail ?? undefined,
    });
  }

  async sendAccountDeletionConfirmation(email: string, fullName?: string): Promise<void> {
    const name = escapeHtml(fullName ?? 'there');
    const subject = 'Your MotoVault account has been scheduled for deletion';
    const html = renderEmailLayout({
      title: 'Account deletion scheduled',
      bodyHtml: `
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 16px;">
          Hi ${name}, your MotoVault account has been scheduled for permanent deletion.
          Your data will be permanently removed in <strong>30 days</strong>.
        </p>
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 24px;">
          If you change your mind, simply log back in to your account within the 30-day grace period
          to cancel the deletion and restore your data.
        </p>
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 8px;">
          <strong>What happens next:</strong>
        </p>
        <ul style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
          <li>Your account is immediately deactivated</li>
          <li>Any active subscriptions will be cancelled</li>
          <li>After 30 days, all data is permanently and irreversibly deleted</li>
        </ul>
        <p style="font-size: 13px; color: ${EMAIL_COLORS.MUTED}; margin-top: 32px; line-height: 1.5;">
          If you didn't request this deletion, please log in immediately to cancel it,
          or contact support@motovault.app for assistance.
        </p>
      `,
    });

    await this.send(email, subject, html);
  }

  async sendAccountDeletionCancelled(email: string, fullName?: string): Promise<void> {
    const name = escapeHtml(fullName ?? 'there');
    const subject = 'Your MotoVault account deletion has been cancelled';
    const html = renderEmailLayout({
      title: 'Account deletion cancelled',
      bodyHtml: `
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 24px;">
          Hi ${name}, great news — your MotoVault account deletion has been cancelled.
          Your account and all your data are fully restored. Welcome back!
        </p>
        <p style="font-size: 13px; color: ${EMAIL_COLORS.MUTED}; margin-top: 32px; line-height: 1.5;">
          If you have any questions, contact us at support@motovault.app.
        </p>
      `,
    });

    await this.send(email, subject, html);
  }

  async sendWaitlistNotification(email: string): Promise<void> {
    const notifyEmail = this.config.get<string>('NOTIFY_EMAIL') ?? 'support@motovault.app';

    // Notify the team
    await this.send(
      notifyEmail,
      `New MotoVault interest: ${email}`,
      renderEmailLayout({
        title: 'New interest signup',
        bodyHtml: `
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 8px;">
          Someone wants to join MotoVault:
        </p>
        <p style="font-size: 18px; font-weight: 600; color: ${EMAIL_COLORS.HEADING}; background: ${EMAIL_COLORS.HIGHLIGHT_BG}; padding: 12px 16px; border-radius: 8px;">
          ${escapeHtml(email)}
        </p>
        <p style="font-size: 13px; color: ${EMAIL_COLORS.MUTED}; margin-top: 24px;">
          Submitted at ${new Date().toISOString()}
        </p>
      `,
      }),
    );

    // Confirm to the user
    await this.send(
      email,
      "You're on the MotoVault list!",
      renderEmailLayout({
        title: 'Welcome to MotoVault',
        bodyHtml: `
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6; margin-bottom: 24px;">
          Thanks for your interest! We'll notify you as soon as MotoVault is available
          on iOS and Android. You'll be among the first to know about updates and early access.
        </p>
        <p style="font-size: 15px; color: ${EMAIL_COLORS.BODY}; line-height: 1.6;">
          Ride safe,<br/>
          <strong>The MotoVault Team</strong>
        </p>
        <p style="font-size: 13px; color: ${EMAIL_COLORS.MUTED}; margin-top: 32px; line-height: 1.5;">
          If you didn't sign up for this, you can safely ignore this email.
        </p>
      `,
      }),
    );
  }

  private async send(
    to: string,
    subject: string,
    html: string,
    options: EmailSendOptions = {},
  ): Promise<EmailSendResult> {
    if (!this.resend) {
      this.logger.warn(`[DRY RUN] Email to ${to}: ${subject}`);
      return { ok: false, error: DRY_RUN_ERROR };
    }

    try {
      const { error } = await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
        ...(options.replyTo && { replyTo: options.replyTo }),
      });

      if (error) {
        const detail = JSON.stringify(error);
        this.logger.error(`Failed to send email to ${to}: ${detail}`);
        return { ok: false, error: detail };
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
      return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Email send error to ${to}: ${message}`);
      return { ok: false, error: message };
    }
  }
}
