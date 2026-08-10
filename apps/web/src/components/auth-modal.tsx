'use client';

import { palette } from '@motovault/design-system';
import { useCallback, useRef, useState } from 'react';
import { useModal } from '@/hooks/use-modal';
import {
  type AuthErrorRecovery,
  EMPTY_FIELDS_MESSAGE,
  hasCredentials,
  humanizeAuthError,
  recoveryForAttempt,
} from '@/lib/auth-errors';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** What the user was trying to do — shown in the modal title */
  action?: string;
}

export function AuthModal({ open, onClose, action = 'continue' }: AuthModalProps) {
  // Constructed lazily inside the submit handlers, NOT in a useMemo. A client
  // component's hooks still run during the server render pass, so a useMemo here
  // called createBrowserClient at prerender time — and with the public Supabase
  // env vars absent from that environment, @supabase/ssr throws "Your project's
  // URL and API key are required", failing the whole export. It surfaced the
  // moment trip pages started being prerendered (they render this via
  // GpxDownloadButton); every other call site already constructs inside a handler
  // or effect, which is why this was the only one affected.
  //
  // Nothing is lost: all three uses below are in async handlers, so the memo was
  // never saving work on a path the user actually hits.
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<AuthErrorRecovery>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  useModal(open, onClose, dialogRef);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (!hasCredentials(email, password)) {
        setError(
          mode === 'signin'
            ? EMPTY_FIELDS_MESSAGE
            : 'Enter your email and password to create an account.',
        );
        setRecovery(null);
        return;
      }
      setLoading(true);
      setError('');
      setRecovery(null);
      setResendState('idle');

      if (mode === 'signin') {
        const supabase = getSupabaseBrowserClient();
        const { error } = await supabase.auth.signInWithPassword({
          email: email.trim(),
          password,
        });
        if (error) {
          const errorInfo = humanizeAuthError(error);
          const attempts = failedAttempts + 1;
          setFailedAttempts(attempts);
          setError(errorInfo.message);
          setRecovery(recoveryForAttempt(errorInfo, attempts));
          setLoading(false);
        } else {
          window.location.reload();
        }
      } else {
        const supabase = getSupabaseBrowserClient();
        const { data, error } = await supabase.auth.signUp({ email: email.trim(), password });
        if (error) {
          setError(humanizeAuthError(error).message);
          setLoading(false);
        } else if (data.user && !data.session) {
          setInfo('We sent a confirmation link to your email. Open it to finish signing up.');
          setError('');
          setLoading(false);
        } else {
          window.location.reload();
        }
      }
    },
    [mode, email, password, loading, failedAttempts],
  );

  const handleResendConfirmation = useCallback(async () => {
    if (resendState === 'sending' || !email.trim()) return;
    setResendState('sending');
    const supabase = getSupabaseBrowserClient();
    const { error } = await supabase.auth.resend({ type: 'signup', email: email.trim() });
    if (error) {
      setError(humanizeAuthError(error).message);
      setResendState('idle');
    } else {
      setResendState('sent');
    }
  }, [email, resendState]);

  const handleOAuth = useCallback(async (provider: 'google' | 'apple') => {
    setOauthLoading(provider);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`,
      },
    });
  }, []);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: 'rgba(0,0,0,0.7)' }}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={() => {}}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div
        ref={dialogRef}
        tabIndex={-1}
        className="w-full max-w-sm rounded-xl border p-6 focus:outline-none"
        style={{ backgroundColor: '#111', borderColor: palette.neutral800 }}
      >
        <h2 id="auth-modal-title" className="text-lg font-semibold text-white">
          {mode === 'signin' ? 'Sign in' : 'Create account'} to {action}
        </h2>

        <div aria-live="polite" aria-atomic="true">
          {error && (
            <div className="mt-3 text-sm text-red-400" role="alert">
              <p>{error}</p>
              {recovery === 'reset_password' && (
                <a
                  href="/forgot-password"
                  className="mt-2 inline-block font-medium text-white underline"
                >
                  Reset your password
                </a>
              )}
              {recovery === 'resend_confirmation' && (
                <button
                  type="button"
                  onClick={handleResendConfirmation}
                  disabled={resendState !== 'idle'}
                  className="mt-2 inline-block font-medium text-white underline disabled:no-underline disabled:opacity-70"
                >
                  {resendState === 'sent'
                    ? 'Confirmation email sent — check your inbox.'
                    : resendState === 'sending'
                      ? 'Sending…'
                      : 'Resend confirmation email'}
                </button>
              )}
            </div>
          )}
          {info && (
            <p className="mt-3 rounded-lg bg-green-950/50 p-3 text-sm text-green-400">{info}</p>
          )}
        </div>

        {/* OAuth */}
        <div className="mt-5 flex flex-col gap-2.5">
          <button
            type="button"
            onClick={() => handleOAuth('google')}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-medium text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
          </button>
          <button
            type="button"
            onClick={() => handleOAuth('apple')}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-white px-4 py-2.5 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
          >
            {oauthLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
          </button>
        </div>

        {/* Divider */}
        <div className="my-5 flex items-center gap-3">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-neutral-500">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-email" className="text-xs text-neutral-400">
              Email
            </label>
            <input
              id="auth-email"
              type="email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="email"
              className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-white/20 focus:outline-none"
            />
          </div>
          <div className="flex flex-col gap-1.5">
            <label htmlFor="auth-password" className="text-xs text-neutral-400">
              Password
            </label>
            <input
              id="auth-password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
              minLength={6}
              className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-white/20 focus:outline-none"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: palette.signature500 }}
          >
            {loading
              ? mode === 'signin'
                ? 'Signing in\u2026'
                : 'Creating account\u2026'
              : mode === 'signin'
                ? 'Sign in'
                : 'Create account'}
          </button>
        </form>

        <p className="mt-4 text-center text-xs text-neutral-500">
          {mode === 'signin' ? (
            <>
              No account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signup');
                  setError('');
                  setInfo('');
                  setRecovery(null);
                  setResendState('idle');
                }}
                className="font-medium text-white"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Have an account?{' '}
              <button
                type="button"
                onClick={() => {
                  setMode('signin');
                  setError('');
                  setInfo('');
                  setRecovery(null);
                  setResendState('idle');
                }}
                className="font-medium text-white"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
