import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { THEME_INIT_SCRIPT, THEME_INIT_SCRIPT_CSP_HASH } from '../theme-init-script';

describe('theme init script CSP hash', () => {
  it('matches the sha256 of the exact script text the root layout inlines', () => {
    const digest = createHash('sha256').update(THEME_INIT_SCRIPT, 'utf8').digest('base64');
    expect(THEME_INIT_SCRIPT_CSP_HASH).toBe(`'sha256-${digest}'`);
  });
});
