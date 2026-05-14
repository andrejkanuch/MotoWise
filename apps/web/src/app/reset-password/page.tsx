'use client';

import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useMemo, useState } from 'react';

export default function ResetPasswordPage() {
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    [],
  );
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    if (password.length < 6) {
      setError('Password must be at least 6 characters.');
      return;
    }

    setLoading(true);
    setError('');
    const { error } = await supabase.auth.updateUser({ password });
    if (error) {
      setError(error.message);
    } else {
      setSuccess(true);
    }
    setLoading(false);
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-neutral-950 pb-32">
      <div className="w-full max-w-[400px] px-4">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-neutral-50 mb-1">MotoVault</h1>
          <p className="text-neutral-400 mb-6">Enter your new password below.</p>

          {success ? (
            <div className="rounded-xl bg-green-950/50 border border-green-800 p-4">
              <p className="text-sm text-green-400 font-medium">
                Your password has been updated successfully.
              </p>
              <Link
                href="/login"
                className="mt-3 inline-block text-sm text-warm-500 font-medium hover:text-warm-400"
              >
                Sign in with your new password &rarr;
              </Link>
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
                  <label htmlFor="new-password" className="text-sm font-medium text-neutral-400">
                    New password
                  </label>
                  <input
                    id="new-password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    minLength={6}
                    required
                    autoComplete="new-password"
                    aria-describedby={error ? 'reset-error' : undefined}
                    className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label
                    htmlFor="confirm-password"
                    className="text-sm font-medium text-neutral-400"
                  >
                    Confirm password
                  </label>
                  <input
                    id="confirm-password"
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    minLength={6}
                    required
                    autoComplete="new-password"
                    className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
                  />
                </div>
                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-full bg-warm-500 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-warm-400 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? 'Updating\u2026' : 'Update password'}
                </button>
              </form>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
