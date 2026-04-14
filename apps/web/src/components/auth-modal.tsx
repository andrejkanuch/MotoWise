'use client';

import { palette } from '@motovault/design-system';
import { createBrowserClient } from '@supabase/ssr';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** What the user was trying to do — shown in the modal title */
  action?: string;
}

export function AuthModal({ open, onClose, action = 'continue' }: AuthModalProps) {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    [],
  );

  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Close on Escape
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  // Focus trap
  useEffect(() => {
    if (open) dialogRef.current?.focus();
  }, [open]);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      setLoading(true);
      setError('');

      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) {
          setError(error.message);
          setLoading(false);
        } else {
          window.location.reload();
        }
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) {
          setError(error.message);
          setLoading(false);
        } else if (data.user && !data.session) {
          setError('Check your email for a confirmation link, then try again.');
          setLoading(false);
        } else {
          window.location.reload();
        }
      }
    },
    [mode, email, password, loading, supabase],
  );

  const handleOAuth = useCallback(
    async (provider: 'google' | 'apple') => {
      setOauthLoading(provider);
      await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`,
        },
      });
    },
    [supabase],
  );

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
      aria-label="Sign in"
    >
      <div
        ref={dialogRef}
        className="w-full max-w-sm rounded-xl border p-6"
        style={{ backgroundColor: '#111', borderColor: palette.neutral800 }}
      >
        <h2 className="text-lg font-semibold text-white">
          {mode === 'signin' ? 'Sign in' : 'Create account'} to {action}
        </h2>

        {error && <p className="mt-3 text-sm text-red-400">{error}</p>}

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
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-white/20 focus:outline-none"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            className="rounded-lg border border-white/10 bg-white/5 px-3.5 py-2.5 text-sm text-white placeholder:text-neutral-500 focus:border-white/20 focus:outline-none"
          />
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg py-2.5 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: palette.signature500 }}
          >
            {loading ? 'Loading...' : mode === 'signin' ? 'Sign in' : 'Create account'}
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
