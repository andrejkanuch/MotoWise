'use client';

import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';

export default function ForgotPasswordPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    [],
  );
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/auth/callback`,
    });
    if (error) {
      setError(error.message);
    } else {
      trackEvent(WebEvent.PASSWORD_RESET_REQUESTED);
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-neutral-950 pb-32">
      <div className="w-full max-w-[400px] px-4">
        <Link
          href="/login"
          className="inline-block mb-6 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          &larr; Back to sign in
        </Link>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-neutral-50 mb-1">MotoVault</h1>
          <p className="text-neutral-400 mb-6">
            Enter your email and we&apos;ll send a link to reset your password.
          </p>

          {success ? (
            <div className="rounded-xl bg-green-950/50 border border-green-800 p-4">
              <p className="text-sm text-green-400 font-medium">
                We sent a reset link to <strong>{email}</strong>. Check your inbox (and spam
                folder).
              </p>
              <p className="mt-2 text-xs text-neutral-500">
                Didn&apos;t get it? Wait a minute, then try again.
              </p>
            </div>
          ) : (
            <>
              <div aria-live="polite" aria-atomic="true">
                {error && (
                  <p id="reset-error" role="alert" className="text-sm text-danger-500 mb-4">
                    {error}
                  </p>
                )}
              </div>
              <form onSubmit={handleReset} className="flex flex-col gap-4">
                <div className="flex flex-col gap-1.5">
                  <label htmlFor="reset-email" className="text-sm font-medium text-neutral-400">
                    Email
                  </label>
                  <input
                    id="reset-email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    maxLength={255}
                    required
                    aria-describedby={error ? 'reset-error' : undefined}
                    className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-warm-500 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-warm-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Sending reset link\u2026' : 'Send reset link'}
                </button>
              </form>
            </>
          )}

          <p className="mt-6 text-center text-sm text-neutral-500">
            Remember your password?{' '}
            <Link href="/login" className="text-warm-500 font-medium hover:text-warm-400">
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
