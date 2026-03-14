'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';
import { useMemo, useState } from 'react';

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
      ),
    [],
  );
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-neutral-950">
      <div className="w-full max-w-[400px] px-4">
        <a
          href="/"
          className="inline-block mb-6 text-sm text-neutral-500 transition-colors hover:text-neutral-300"
        >
          &larr; Back to home
        </a>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-2xl p-8">
          <h1 className="text-3xl font-bold text-neutral-50 mb-1">MotoVault</h1>
          <p className="text-neutral-400 mb-6">Sign In</p>
          {error && (
            <p id="login-error" role="alert" className="text-sm text-danger-500 mb-4">
              {error}
            </p>
          )}
          <form onSubmit={handleLogin} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-email" className="text-sm font-medium text-neutral-400">
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                maxLength={255}
                required
                aria-describedby={error ? 'login-error' : undefined}
                className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="login-password" className="text-sm font-medium text-neutral-400">
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                maxLength={128}
                required
                aria-describedby={error ? 'login-error' : undefined}
                className="bg-neutral-900 border border-neutral-700 rounded-xl px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              />
            </div>
            <button
              type="submit"
              disabled={loading}
              className="w-full rounded-full bg-warm-500 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-warm-400 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
