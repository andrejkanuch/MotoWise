import { describe, expect, it } from 'vitest';
import { FEEDBACK_CONTACT_SOURCE, FEEDBACK_QUICK_PICK } from '../../constants/feedback';
import { SendFeedbackInputSchema } from '../feedback';
import { UserPreferencesSchema } from '../user-preferences';

const validInput = {
  clientId: '7f1c2a8e-3b4d-4c5e-9f60-1a2b3c4d5e6f',
  message: 'The fuel log is great',
  platform: 'ios',
  appVersion: '3.25.0',
  locale: 'en',
  contactOptIn: false,
  contactWordingVersion: 1,
};

const EMOJI = '🏍️'.slice(0, 2); // one astral code point (two UTF-16 units)

describe('SendFeedbackInputSchema', () => {
  it('accepts a minimal message and trims it', () => {
    const result = SendFeedbackInputSchema.parse({ ...validInput, message: '  hi  ' });
    expect(result.message).toBe('hi');
  });

  it('rejects a whitespace-only message', () => {
    expect(SendFeedbackInputSchema.safeParse({ ...validInput, message: ' \n\t ' }).success).toBe(
      false,
    );
  });

  it('rejects a 4001-character message', () => {
    expect(
      SendFeedbackInputSchema.safeParse({ ...validInput, message: 'a'.repeat(4001) }).success,
    ).toBe(false);
  });

  it('accepts a 4000-character message with emoji', () => {
    const message = `${'a'.repeat(3998)}${EMOJI}${EMOJI}`;
    expect([...message]).toHaveLength(4000);
    expect(SendFeedbackInputSchema.safeParse({ ...validInput, message }).success).toBe(true);
  });

  it('accepts every known quick pick and rejects an unknown one', () => {
    for (const quickPick of Object.values(FEEDBACK_QUICK_PICK)) {
      expect(SendFeedbackInputSchema.safeParse({ ...validInput, quickPick }).success).toBe(true);
    }
    expect(SendFeedbackInputSchema.safeParse({ ...validInput, quickPick: 'hate' }).success).toBe(
      false,
    );
  });

  it('rejects a contact email containing CR LF', () => {
    const result = SendFeedbackInputSchema.safeParse({
      ...validInput,
      contactOptIn: true,
      contactEmail: 'rider@example.com\r\nBcc: victim@example.com',
    });
    expect(result.success).toBe(false);
  });

  it('rejects a contact email longer than 254 characters', () => {
    const contactEmail = `${'a'.repeat(64)}@${'b'.repeat(186)}.com`;
    expect(contactEmail.length).toBe(255);
    expect(SendFeedbackInputSchema.safeParse({ ...validInput, contactEmail }).success).toBe(false);
  });

  it('accepts a null contact email (use the account email)', () => {
    const result = SendFeedbackInputSchema.parse({
      ...validInput,
      contactOptIn: true,
      contactEmail: null,
    });
    expect(result.contactEmail).toBeUndefined();
  });
});

describe('UserPreferencesSchema.feedbackContact', () => {
  const contact = {
    enabled: true,
    email: null,
    decidedAt: '2026-10-12T10:00:00.000Z',
    wordingVersion: 1,
    locale: 'de',
    source: FEEDBACK_CONTACT_SOURCE.NOTIFICATIONS,
  };

  it('accepts feedbackContact with email null', () => {
    const result = UserPreferencesSchema.parse({ feedbackContact: contact });
    expect(result.feedbackContact).toEqual(contact);
  });

  it('rejects a feedbackContact email that is not an email', () => {
    expect(
      UserPreferencesSchema.safeParse({ feedbackContact: { ...contact, email: 'not-an-email' } })
        .success,
    ).toBe(false);
  });

  it('still passes unknown keys through', () => {
    const result = UserPreferencesSchema.parse({ feedbackContact: contact, theme: 'dark' });
    expect(result).toMatchObject({ theme: 'dark' });
  });
});
