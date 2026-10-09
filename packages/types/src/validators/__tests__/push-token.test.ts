import { describe, expect, it } from 'vitest';
import { RegisterPushTokenSchema, UnregisterPushTokenSchema } from '../push-token';

describe('UnregisterPushTokenSchema', () => {
  it('accepts an Expo push token', () => {
    expect(UnregisterPushTokenSchema.safeParse({ token: 'ExponentPushToken[abc]' }).success).toBe(
      true,
    );
    expect(UnregisterPushTokenSchema.safeParse({ token: 'ExpoPushToken[abc]' }).success).toBe(true);
  });

  it('rejects anything that is not an Expo push token', () => {
    for (const token of [
      '',
      'junk',
      'ExponentPushToken[]',
      `ExponentPushToken[${'a'.repeat(300)}]`,
    ]) {
      expect(UnregisterPushTokenSchema.safeParse({ token }).success).toBe(false);
    }
  });

  it('uses the same token rule as registration', () => {
    const token = 'ExponentPushToken[abc]';
    expect(UnregisterPushTokenSchema.safeParse({ token }).success).toBe(
      RegisterPushTokenSchema.safeParse({ token, platform: 'ios' }).success,
    );
  });
});
