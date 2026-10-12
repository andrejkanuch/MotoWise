import { FEEDBACK_CONTACT_SOURCE, FEEDBACK_QUICK_PICK } from '@motovault/types';
import { InternalServerErrorException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import type { SendFeedbackInput } from './dto/send-feedback.input';
import { FeedbackService } from './feedback.service';

vi.mock('@sentry/nestjs', () => ({ captureMessage: vi.fn(), captureException: vi.fn() }));

const USER: AuthUser = { id: 'user-1', email: 'jwt@example.com', role: 'user', tier: 'free' };
const CLIENT_ID = '7f1c2a8e-3b4d-4c5e-9f60-1a2b3c4d5e6f';

const BIKE = {
  id: 'bike-1',
  make: 'Honda',
  model: 'Africa Twin',
  year: 2022,
  nickname: 'Twin',
};

function baseInput(overrides: Partial<SendFeedbackInput> = {}): SendFeedbackInput {
  return {
    clientId: CLIENT_ID,
    message: 'Fuel log is great',
    quickPick: FEEDBACK_QUICK_PICK.LOVE,
    platform: 'ios',
    appVersion: '3.25.0',
    updateId: 'upd-1',
    locale: 'en',
    contactOptIn: false,
    contactEmail: undefined,
    contactWordingVersion: 1,
    ...overrides,
  };
}

/** Records every insert/update payload per table, like a tiny fake PostgREST. */
function createUserClient(opts: { insertError?: { code: string; message: string } | null }) {
  const inserts: Array<{ table: string; row: Record<string, unknown> }> = [];
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'motorcycles') {
        const chain: Record<string, unknown> = {};
        for (const m of ['select', 'eq', 'is', 'order', 'limit']) chain[m] = () => chain;
        chain.maybeSingle = async () => ({ data: BIKE, error: null });
        return chain;
      }
      return {
        insert: async (row: Record<string, unknown>) => {
          inserts.push({ table, row });
          return { error: opts.insertError ?? null };
        },
      };
    }),
  };
  return { client, inserts };
}

function createAdminClient(storedPreferences: Record<string, unknown> | null) {
  const updates: Array<{ table: string; payload: Record<string, unknown>; filters: unknown[] }> =
    [];
  const client = {
    from: vi.fn((table: string) => {
      if (table === 'users') {
        const chain: Record<string, unknown> = {};
        chain.select = () => chain;
        chain.eq = () => chain;
        chain.single = async () => ({
          data: { email: 'account@example.com', preferences: storedPreferences },
          error: null,
        });
        return chain;
      }
      return {
        update: (payload: Record<string, unknown>) => {
          const filters: unknown[] = [];
          updates.push({ table, payload, filters });
          const chain = {
            eq: (col: string, val: unknown) => {
              filters.push([col, val]);
              return chain;
            },
            // biome-ignore lint/suspicious/noThenProperty: mimics a thenable PostgREST builder
            then: (resolve: (v: unknown) => void) => resolve({ error: null }),
          };
          return chain;
        },
      };
    }),
  };
  return { client, updates };
}

function setup(opts: {
  insertError?: { code: string; message: string } | null;
  storedPreferences?: Record<string, unknown> | null;
  emailResult?: { ok: boolean; error?: string };
}) {
  const user = createUserClient({ insertError: opts.insertError });
  const admin = createAdminClient(opts.storedPreferences ?? null);
  const emailService = {
    sendFeedbackNotification: vi.fn().mockResolvedValue(opts.emailResult ?? { ok: true }),
  };
  const usersService = { update: vi.fn().mockResolvedValue({}) };
  const service = new FeedbackService(
    user.client as never,
    admin.client as never,
    emailService as never,
    usersService as never,
  );
  return { service, user, admin, emailService, usersService };
}

/** The email runs after the mutation returns; wait for its bookkeeping write. */
async function flushBackground() {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('FeedbackService.sendFeedback', () => {
  beforeEach(() => vi.clearAllMocks());

  it('saves a new message once, returns true and emails it with its context', async () => {
    const t = setup({});
    await expect(t.service.sendFeedback(USER, baseInput())).resolves.toBe(true);

    expect(t.user.inserts).toEqual([
      {
        table: 'feedback_messages',
        row: {
          user_id: 'user-1',
          client_id: CLIENT_ID,
          message: 'Fuel log is great',
          quick_pick: 'love',
          platform: 'ios',
          app_version: '3.25.0',
          update_id: 'upd-1',
          locale: 'en',
          motorcycle_id: 'bike-1',
          contact_allowed: false,
          contact_email: null,
        },
      },
    ]);

    await flushBackground();
    expect(t.emailService.sendFeedbackNotification).toHaveBeenCalledTimes(1);
    expect(t.emailService.sendFeedbackNotification.mock.calls[0][0]).toMatchObject({
      userId: 'user-1',
      message: 'Fuel log is great',
      quickPick: 'love',
      appVersion: '3.25.0',
      platform: 'ios',
      bikeName: 'Twin (2022 Honda Africa Twin)',
    });
    expect(t.admin.updates).toHaveLength(1);
    expect(t.admin.updates[0].table).toBe('feedback_messages');
    expect(t.admin.updates[0].payload).toHaveProperty('emailed_at');
    expect(t.admin.updates[0].filters).toEqual([
      ['user_id', 'user-1'],
      ['client_id', CLIENT_ID],
    ]);
  });

  it('treats a duplicate clientId (23505) as success: no email, no preference write', async () => {
    const t = setup({ insertError: { code: '23505', message: 'duplicate key' } });
    await expect(t.service.sendFeedback(USER, baseInput({ contactOptIn: true }))).resolves.toBe(
      true,
    );

    await flushBackground();
    expect(t.emailService.sendFeedbackNotification).not.toHaveBeenCalled();
    expect(t.usersService.update).not.toHaveBeenCalled();
    expect(t.admin.updates).toEqual([]);
  });

  it('throws on any other insert error so the client keeps the draft', async () => {
    const t = setup({ insertError: { code: '42501', message: 'permission denied' } });
    await expect(t.service.sendFeedback(USER, baseInput())).rejects.toThrow(
      InternalServerErrorException,
    );
    expect(t.emailService.sendFeedbackNotification).not.toHaveBeenCalled();
  });

  it('opted in with a custom email: replies go to it and the choice is saved from the form', async () => {
    const t = setup({});
    await t.service.sendFeedback(
      USER,
      baseInput({ contactOptIn: true, contactEmail: 'me@personal.dev', locale: 'de' }),
    );

    expect(t.user.inserts[0].row).toMatchObject({
      contact_allowed: true,
      contact_email: 'me@personal.dev',
    });
    expect(t.usersService.update).toHaveBeenCalledTimes(1);
    const [userId, patch] = t.usersService.update.mock.calls[0];
    expect(userId).toBe('user-1');
    expect(patch.preferences.feedbackContact).toMatchObject({
      enabled: true,
      email: 'me@personal.dev',
      wordingVersion: 1,
      locale: 'de',
      source: FEEDBACK_CONTACT_SOURCE.FORM,
    });
    expect(typeof patch.preferences.feedbackContact.decidedAt).toBe('string');

    await flushBackground();
    expect(t.emailService.sendFeedbackNotification.mock.calls[0][0].contactEmail).toBe(
      'me@personal.dev',
    );
  });

  it('opted in with no custom email: replies go to the JWT email', async () => {
    const t = setup({});
    await t.service.sendFeedback(USER, baseInput({ contactOptIn: true }));

    expect(t.user.inserts[0].row.contact_email).toBe('jwt@example.com');
    expect(t.usersService.update.mock.calls[0][1].preferences.feedbackContact.email).toBeNull();
    await flushBackground();
    expect(t.emailService.sendFeedbackNotification.mock.calls[0][0].contactEmail).toBe(
      'jwt@example.com',
    );
  });

  it('does not rewrite the opt-in when it did not change', async () => {
    const t = setup({
      storedPreferences: {
        feedbackContact: {
          enabled: true,
          email: null,
          decidedAt: '2026-10-01T00:00:00.000Z',
          wordingVersion: 1,
          locale: 'en',
          source: 'notifications',
        },
      },
    });
    await t.service.sendFeedback(USER, baseInput({ contactOptIn: true }));
    expect(t.usersService.update).not.toHaveBeenCalled();
  });

  it('not opted in: no contact email reaches the notification', async () => {
    const t = setup({});
    await t.service.sendFeedback(USER, baseInput({ contactEmail: 'me@personal.dev' }));
    expect(t.user.inserts[0].row).toMatchObject({ contact_allowed: false, contact_email: null });
    await flushBackground();
    expect(t.emailService.sendFeedbackNotification.mock.calls[0][0].contactEmail).toBeNull();
  });

  it('email failure: records email_error with the admin client, mutation still succeeds', async () => {
    const t = setup({ emailResult: { ok: false, error: 'resend 500' } });
    await expect(t.service.sendFeedback(USER, baseInput())).resolves.toBe(true);

    await flushBackground();
    expect(t.admin.updates).toHaveLength(1);
    expect(t.admin.updates[0].payload).toEqual({ email_error: 'resend 500' });
    expect(t.admin.updates[0].filters).toEqual([
      ['user_id', 'user-1'],
      ['client_id', CLIENT_ID],
    ]);
  });

  it('email throwing: records email_error instead of an unhandled rejection', async () => {
    const t = setup({});
    t.emailService.sendFeedbackNotification.mockRejectedValueOnce(new Error('network down'));
    await expect(t.service.sendFeedback(USER, baseInput())).resolves.toBe(true);

    await flushBackground();
    expect(t.admin.updates[0].payload).toEqual({ email_error: 'network down' });
  });
});
