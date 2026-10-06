import { describe, expect, it } from 'vitest';
import { envSchema } from './env.validation';

const REQUIRED = {
  SUPABASE_URL: 'https://test.supabase.co',
  SUPABASE_ANON_KEY: 'anon',
  SUPABASE_SERVICE_ROLE_KEY: 'service',
  SUPABASE_JWT_SECRET: 'jwt',
  OPENAI_API_KEY: 'openai',
};

const USER_A = '6fb4b88f-c0eb-4bb2-b767-9f45b00c53f2';
const USER_B = '22222222-2222-2222-2222-222222222222';

describe('REVENUECAT_SANDBOX_ALLOWED_USER_IDS', () => {
  const parse = (value?: string) =>
    envSchema.parse({ ...REQUIRED, REVENUECAT_SANDBOX_ALLOWED_USER_IDS: value })
      .REVENUECAT_SANDBOX_ALLOWED_USER_IDS;

  it.each([undefined, '', ' , '])('is an empty allowlist when unset or blank (%j)', (value) => {
    expect(parse(value)).toEqual([]);
  });

  it('parses a comma-separated list, trimming and lower-casing', () => {
    expect(parse(` ${USER_A.toUpperCase()} ,${USER_B},`)).toEqual([USER_A, USER_B]);
  });

  it('rejects a non-UUID entry at boot', () => {
    expect(() => parse(`${USER_A},test@test.com`)).toThrow();
  });
});
