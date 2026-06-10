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
});
