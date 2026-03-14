import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Resend } from 'resend';

const FROM_ADDRESS = 'MotoVault <noreply@motovault.app>';

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
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px;">
          Your data export is ready
        </h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          We've compiled all your MotoVault data. Click the button below to download your export file.
          This link will expire in 7 days.
        </p>
        <a href="${downloadUrl}" style="display: inline-block; padding: 14px 28px; background: linear-gradient(135deg, #6366F1, #818CF8); color: #FFFFFF; font-size: 15px; font-weight: 600; text-decoration: none; border-radius: 12px;">
          Download Your Data
        </a>
        <p style="font-size: 13px; color: #94A3B8; margin-top: 32px; line-height: 1.5;">
          If you didn't request this export, you can safely ignore this email.
          For questions, contact us at support@motovault.app.
        </p>
      </div>
    `;

    await this.send(email, subject, html);
  }

  async sendAccountDeletionConfirmation(email: string, fullName?: string): Promise<void> {
    const name = fullName ?? 'there';
    const subject = 'Your MotoVault account has been scheduled for deletion';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px;">
          Account deletion scheduled
        </h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 16px;">
          Hi ${name}, your MotoVault account has been scheduled for permanent deletion.
          Your data will be permanently removed in <strong>30 days</strong>.
        </p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          If you change your mind, simply log back in to your account within the 30-day grace period
          to cancel the deletion and restore your data.
        </p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 8px;">
          <strong>What happens next:</strong>
        </p>
        <ul style="font-size: 15px; color: #475569; line-height: 1.8; padding-left: 20px; margin-bottom: 24px;">
          <li>Your account is immediately deactivated</li>
          <li>Any active subscriptions will be cancelled</li>
          <li>After 30 days, all data is permanently and irreversibly deleted</li>
        </ul>
        <p style="font-size: 13px; color: #94A3B8; margin-top: 32px; line-height: 1.5;">
          If you didn't request this deletion, please log in immediately to cancel it,
          or contact support@motovault.app for assistance.
        </p>
      </div>
    `;

    await this.send(email, subject, html);
  }

  async sendAccountDeletionCancelled(email: string, fullName?: string): Promise<void> {
    const name = fullName ?? 'there';
    const subject = 'Your MotoVault account deletion has been cancelled';
    const html = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px;">
          Account deletion cancelled
        </h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          Hi ${name}, great news — your MotoVault account deletion has been cancelled.
          Your account and all your data are fully restored. Welcome back!
        </p>
        <p style="font-size: 13px; color: #94A3B8; margin-top: 32px; line-height: 1.5;">
          If you have any questions, contact us at support@motovault.app.
        </p>
      </div>
    `;

    await this.send(email, subject, html);
  }

  async sendWaitlistNotification(email: string): Promise<void> {
    const notifyEmail = this.config.get<string>('NOTIFY_EMAIL') ?? 'kanuchandrej@gmail.com';

    // Notify the team
    await this.send(
      notifyEmail,
      `New MotoVault interest: ${email}`,
      `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px;">
          New interest signup
        </h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 8px;">
          Someone wants to join MotoVault:
        </p>
        <p style="font-size: 18px; font-weight: 600; color: #0F172A; background: #F1F5F9; padding: 12px 16px; border-radius: 8px;">
          ${email}
        </p>
        <p style="font-size: 13px; color: #94A3B8; margin-top: 24px;">
          Submitted at ${new Date().toISOString()}
        </p>
      </div>
    `,
    );

    // Confirm to the user
    await this.send(
      email,
      "You're on the MotoVault list!",
      `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px 16px;">
        <h1 style="font-size: 22px; font-weight: 700; color: #0F172A; margin-bottom: 16px;">
          Welcome to MotoVault
        </h1>
        <p style="font-size: 15px; color: #475569; line-height: 1.6; margin-bottom: 24px;">
          Thanks for your interest! We'll notify you as soon as MotoVault is available
          on iOS and Android. You'll be among the first to know about updates and early access.
        </p>
        <p style="font-size: 15px; color: #475569; line-height: 1.6;">
          Ride safe,<br/>
          <strong>The MotoVault Team</strong>
        </p>
        <p style="font-size: 13px; color: #94A3B8; margin-top: 32px; line-height: 1.5;">
          If you didn't sign up for this, you can safely ignore this email.
        </p>
      </div>
    `,
    );
  }

  private async send(to: string, subject: string, html: string): Promise<void> {
    if (!this.resend) {
      this.logger.warn(`[DRY RUN] Email to ${to}: ${subject}`);
      return;
    }

    try {
      const { error } = await this.resend.emails.send({
        from: FROM_ADDRESS,
        to,
        subject,
        html,
      });

      if (error) {
        this.logger.error(`Failed to send email to ${to}: ${JSON.stringify(error)}`);
        return;
      }

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Email send error to ${to}: ${message}`);
    }
  }
}
