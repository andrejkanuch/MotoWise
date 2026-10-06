/**
 * Post-auth contract for the restyled /login and /signup pages.
 *
 * The AuthV2 restyle rewrote both pages' JSX; the post-signup "Get the app"
 * handoff (lib/post-auth-redirect.ts) changed where a session lands. This test
 * pins the handoff logic onto the new pages so a later UI pass cannot drop it:
 *
 * - /login sends a password sign-in through `postAuthDestination` (never the
 *   bare `safeRedirectPath`, which skips /welcome on a first session), and
 *   gives its "Resend confirmation email" the same `emailRedirectTo` as
 *   /signup, so the resent link also returns through /auth/callback.
 * - /signup passes `emailRedirectTo: signUpEmailRedirectTo(...)` to
 *   `supabase.auth.signUp` (and to the resend of the confirmation email), so
 *   the link returns through /auth/callback, and sends an instant session
 *   through `postAuthDestination`.
 *
 * The pages are client components with no DOM test environment here, so the
 * contract is checked on the TypeScript AST rather than by rendering.
 */
import fs from 'node:fs';
import path from 'node:path';
import ts from 'typescript';
import { describe, expect, it } from 'vitest';

const APP = path.join(process.cwd(), 'src/app');
const POST_AUTH_MODULE = '@/lib/post-auth-redirect';
const POST_AUTH_DESTINATION = 'postAuthDestination';
const SIGN_UP_EMAIL_REDIRECT_TO = 'signUpEmailRedirectTo';
const LOCATION_HREF = 'window.location.href';

function parse(relative: string): ts.SourceFile {
  const file = path.join(APP, relative);
  return ts.createSourceFile(
    file,
    fs.readFileSync(file, 'utf8'),
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TSX,
  );
}

function collect<T extends ts.Node>(root: ts.Node, guard: (n: ts.Node) => n is T): T[] {
  const out: T[] = [];
  const visit = (n: ts.Node) => {
    if (guard(n)) out.push(n);
    ts.forEachChild(n, visit);
  };
  visit(root);
  return out;
}

const calls = (sf: ts.SourceFile) => collect(sf, ts.isCallExpression);

function callsTo(sf: ts.SourceFile, callee: string): ts.CallExpression[] {
  return calls(sf).filter((c) => c.expression.getText(sf) === callee);
}

/** Calls whose callee ends in `.auth.<method>` (e.g. `supabase.auth.signUp`). */
function authCalls(sf: ts.SourceFile, method: string): ts.CallExpression[] {
  return calls(sf).filter((c) => c.expression.getText(sf).endsWith(`.auth.${method}`));
}

function property(obj: ts.Expression | undefined, name: string): ts.Expression | undefined {
  if (!obj || !ts.isObjectLiteralExpression(obj)) return undefined;
  for (const p of obj.properties) {
    if (ts.isPropertyAssignment(p) && p.name.getText() === name) return p.initializer;
  }
  return undefined;
}

function isCallTo(sf: ts.SourceFile, expr: ts.Expression | undefined, callee: string): boolean {
  return !!expr && ts.isCallExpression(expr) && expr.expression.getText(sf) === callee;
}

function importsFrom(sf: ts.SourceFile, moduleName: string): string[] {
  return sf.statements
    .filter(ts.isImportDeclaration)
    .filter((d) => (d.moduleSpecifier as ts.StringLiteral).text === moduleName)
    .flatMap((d) => {
      const bindings = d.importClause?.namedBindings;
      return bindings && ts.isNamedImports(bindings)
        ? bindings.elements.map((e) => e.name.text)
        : [];
    });
}

/** Every right-hand side assigned to `window.location.href`. */
function hrefAssignments(sf: ts.SourceFile): ts.Expression[] {
  return collect(sf, ts.isBinaryExpression)
    .filter(
      (b) =>
        b.operatorToken.kind === ts.SyntaxKind.EqualsToken && b.left.getText(sf) === LOCATION_HREF,
    )
    .map((b) => b.right);
}

/** True when `call` is `postAuthDestination({ redirect, user: data.user })`. */
function isPostAuthCallWithUser(sf: ts.SourceFile, call: ts.CallExpression): boolean {
  const [arg] = call.arguments;
  return !!property(arg, 'redirect') && property(arg, 'user')?.getText(sf) === 'data.user';
}

describe('post-auth contract: /login', () => {
  const sf = parse('login/page.tsx');

  it('imports postAuthDestination and no longer uses safeRedirectPath', () => {
    expect(importsFrom(sf, POST_AUTH_MODULE)).toContain(POST_AUTH_DESTINATION);
    expect(sf.getFullText()).not.toMatch(/\bsafeRedirectPath\b/);
  });

  it('sends a password sign-in to postAuthDestination with the signed-in user', () => {
    const postAuth = callsTo(sf, POST_AUTH_DESTINATION);
    expect(postAuth).toHaveLength(1);
    expect(isPostAuthCallWithUser(sf, postAuth[0])).toBe(true);

    // The result is what the page navigates to.
    const [href] = hrefAssignments(sf);
    expect(href).toBeDefined();
    const target = href.getText(sf);
    const declaration = collect(sf, ts.isVariableDeclaration).find(
      (d) => d.name.getText(sf) === target,
    );
    expect(
      isCallTo(sf, href, POST_AUTH_DESTINATION) ||
        isCallTo(sf, declaration?.initializer, POST_AUTH_DESTINATION),
    ).toBe(true);
  });
});

function expectResendsCarryEmailRedirectTo(sf: ts.SourceFile) {
  const resends = authCalls(sf, 'resend');
  expect(resends.length).toBeGreaterThan(0);
  for (const resend of resends) {
    const options = property(resend.arguments[0], 'options');
    expect(isCallTo(sf, property(options, 'emailRedirectTo'), SIGN_UP_EMAIL_REDIRECT_TO)).toBe(
      true,
    );
  }
}

describe('post-auth contract: /login resend', () => {
  const sf = parse('login/page.tsx');

  it('imports signUpEmailRedirectTo', () => {
    expect(importsFrom(sf, POST_AUTH_MODULE)).toContain(SIGN_UP_EMAIL_REDIRECT_TO);
  });

  it('gives the resent confirmation email emailRedirectTo: signUpEmailRedirectTo(...)', () => {
    expectResendsCarryEmailRedirectTo(sf);
  });
});

describe('post-auth contract: /signup', () => {
  const sf = parse('signup/page.tsx');

  it('imports both post-auth helpers', () => {
    expect(importsFrom(sf, POST_AUTH_MODULE)).toEqual(
      expect.arrayContaining([POST_AUTH_DESTINATION, SIGN_UP_EMAIL_REDIRECT_TO]),
    );
  });

  it('passes emailRedirectTo: signUpEmailRedirectTo(...) to supabase.auth.signUp', () => {
    const signUp = authCalls(sf, 'signUp');
    expect(signUp).toHaveLength(1);
    const options = property(signUp[0].arguments[0], 'options');
    expect(isCallTo(sf, property(options, 'emailRedirectTo'), SIGN_UP_EMAIL_REDIRECT_TO)).toBe(
      true,
    );
    // The marketing-consent metadata still rides along.
    expect(options?.getText(sf)).toContain('signUpConsentOptions(');
  });

  it('gives the resent confirmation email the same emailRedirectTo', () => {
    expectResendsCarryEmailRedirectTo(sf);
  });

  it('sends an instant session to postAuthDestination with the new user', () => {
    const hrefs = hrefAssignments(sf);
    expect(hrefs).toHaveLength(1);
    expect(isCallTo(sf, hrefs[0], POST_AUTH_DESTINATION)).toBe(true);
    expect(isPostAuthCallWithUser(sf, hrefs[0] as ts.CallExpression)).toBe(true);
  });
});
