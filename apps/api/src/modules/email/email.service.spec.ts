import type { ConfigService } from '@nestjs/config';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { EmailService } from './email.service';

const { sendMock } = vi.hoisted(() => ({
  sendMock: vi.fn().mockResolvedValue({ error: null }),
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: sendMock };
  },
}));

function createService(): EmailService {
  const config = {
    get: vi
      .fn()
      .mockImplementation((key: string) => (key === 'RESEND_API_KEY' ? 'test-key' : undefined)),
  } as unknown as ConfigService;
  return new EmailService(config);
}

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(() => {
    sendMock.mockClear();
    service = createService();
  });

  it('escapes HTML in fullName so injected markup comes out inert', async () => {
    await service.sendAccountDeletionConfirmation(
      'rider@example.com',
      '<img src=x onerror=alert(1)>',
    );

    expect(sendMock).toHaveBeenCalledTimes(1);
    const { html } = sendMock.mock.calls[0][0];
    expect(html).not.toContain('<img src=x onerror=alert(1)>');
    expect(html).toContain('&lt;img src=x onerror=alert(1)&gt;');
  });

  it('escapes HTML in the waitlist email address', async () => {
    await service.sendWaitlistNotification('"><script>alert(1)</script>@evil.com');

    const teamHtml = sendMock.mock.calls[0][0].html;
    expect(teamHtml).not.toContain('<script>');
    expect(teamHtml).toContain('&lt;script&gt;');
  });

  it('falls back to a greeting when fullName is missing', async () => {
    await service.sendAccountDeletionCancelled('rider@example.com');

    const { html } = sendMock.mock.calls[0][0];
    expect(html).toContain('Hi there');
  });

  describe('sendFeedbackNotification', () => {
    const base = {
      userId: 'user-1',
      message: 'Love it <script>alert(1)</script>',
      quickPick: 'broken' as const,
      platform: 'ios' as const,
      appVersion: '3.25.0',
      updateId: null,
      locale: 'en',
      bikeName: '2022 Honda Africa Twin',
      contactEmail: null,
    };

    it('escapes the message and keeps rider text out of the subject', async () => {
      const result = await service.sendFeedbackNotification(base);

      expect(result).toEqual({ ok: true });
      const { html, subject, to } = sendMock.mock.calls[0][0];
      expect(to).toBe('support@motovault.app');
      expect(html).not.toContain('<script>');
      expect(html).toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
      expect(subject).not.toContain('Love it');
      expect(subject).toContain("Something's broken");
      expect(html).toContain('3.25.0');
      expect(html).toContain('2022 Honda Africa Twin');
    });

    it('sets replyTo to the contact email when the rider opted in', async () => {
      await service.sendFeedbackNotification({ ...base, contactEmail: 'me@personal.dev' });
      const payload = sendMock.mock.calls[0][0];
      expect(payload.replyTo).toBe('me@personal.dev');
      expect(payload.html).toContain('me@personal.dev');
    });

    it('sets no replyTo and states no consent when the rider did not opt in', async () => {
      await service.sendFeedbackNotification(base);
      const payload = sendMock.mock.calls[0][0];
      expect(payload.replyTo).toBeUndefined();
      expect(payload.html).toContain('did not opt in to contact');
      expect(payload.html).toContain('user-1');
    });

    it('returns the Resend error instead of swallowing it', async () => {
      sendMock.mockResolvedValueOnce({ error: { name: 'application_error', message: 'boom' } });
      const result = await service.sendFeedbackNotification(base);
      expect(result.ok).toBe(false);
      expect(result.error).toContain('boom');
    });

    it('returns a thrown send error', async () => {
      sendMock.mockRejectedValueOnce(new Error('network down'));
      const result = await service.sendFeedbackNotification(base);
      expect(result).toEqual({ ok: false, error: 'network down' });
    });
  });
});
