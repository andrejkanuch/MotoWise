import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

// Every app-requested confirmation email must carry AUTH_EMAIL_REDIRECT_TO: the
// production "Confirm signup" template compares `{{ .RedirectTo }}` to it to
// send the code-first app email. A call that omits it gets Supabase's SiteURL
// fallback, i.e. the web link-only email, and the rider never receives a code.

const SRC = join(__dirname, '..', '..');
const AUTH_EMAIL_CALL = /\bauth\.(signUp|resend)\(/g;
const CALL_WINDOW = 600;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) return name === '__tests__' ? [] : sourceFiles(path);
    return /\.(ts|tsx)$/.test(name) ? [path] : [];
  });
}

function authEmailCalls(): { file: string; call: string }[] {
  return sourceFiles(SRC).flatMap((file) => {
    const text = readFileSync(file, 'utf8');
    return [...text.matchAll(AUTH_EMAIL_CALL)].map((match) => {
      const start = match.index ?? 0;
      const end = text.indexOf('});', start);
      return {
        file: relative(SRC, file),
        call: text.slice(start, end === -1 ? start + CALL_WINDOW : end),
      };
    });
  });
}

describe('app auth-email redirect contract', () => {
  const calls = authEmailCalls();

  it('finds the signUp and resend call sites it guards', () => {
    expect(calls.length).toBeGreaterThanOrEqual(4);
  });

  it.each(
    calls.map(({ file, call }) => [file, call]),
  )('%s passes AUTH_EMAIL_REDIRECT_TO', (_file, call) => {
    expect(call).toContain('AUTH_EMAIL_REDIRECT_TO');
  });

  it('keeps the redirect URL literal only in config/auth.ts', () => {
    const literal = 'auth/callback?redirect=motovault://auth/callback';
    const owners = sourceFiles(SRC)
      .filter((file) => readFileSync(file, 'utf8').includes(literal))
      .map((file) => relative(SRC, file));
    expect(owners).toEqual([join('config', 'auth.ts')]);
  });
});
