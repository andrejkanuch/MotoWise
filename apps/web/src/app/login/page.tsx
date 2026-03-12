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

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
    } else {
      router.push('/');
    }
  };

  return (
    <div className="flex justify-center items-center min-h-screen bg-[--color-surface] dark:bg-neutral-900">
      <form onSubmit={handleLogin} className="w-[360px] flex flex-col gap-4">
        <h1 className="text-2xl font-bold text-[--color-on-surface] dark:text-neutral-50">
          MotoVault Sign In
        </h1>
        {error && <p className="text-danger-500">{error}</p>}
        <input
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
          className="px-3 py-2 bg-[--color-input-bg] border border-[--color-input-border] rounded-[--radius-input] text-[--color-on-surface] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <input
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
          className="px-3 py-2 bg-[--color-input-bg] border border-[--color-input-border] rounded-[--radius-input] text-[--color-on-surface] dark:bg-neutral-800 dark:border-neutral-700 dark:text-neutral-50 focus:outline-none focus:ring-2 focus:ring-primary-500"
        />
        <button
          type="submit"
          className="px-6 py-3 bg-primary-500 text-white rounded-[--radius-button] border-none cursor-pointer hover:bg-primary-600 transition-colors"
        >
          Sign In
        </button>
      </form>
    </div>
  );
}
