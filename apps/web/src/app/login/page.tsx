'use client';

import { palette } from '@motovault/design-system';
import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useMemo, useState } from 'react';
import { identifyUser, trackEvent, WebEvent } from '@/lib/analytics';

export default function LoginPage() {
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
  const [oauthLoading, setOauthLoading] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError('');
    trackEvent(WebEvent.SIGN_IN_SUBMITTED, { method: 'email' });
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) {
      setError(error.message);
      setLoading(false);
      trackEvent(WebEvent.SIGN_IN_ERROR, { method: 'email', error_message: error.message });
    } else {
      if (data.user) {
        identifyUser(data.user.id);
      }
      const params = new URLSearchParams(window.location.search);
      const redirectTo = params.get('redirect') || '/feed';
      window.location.href = redirectTo;
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading('google');
    trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider: 'google' });
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/feed')}`,
      },
    });
  };

  const handleAppleSignIn = async () => {
    setOauthLoading('apple');
    trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider: 'apple' });
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/feed')}`,
      },
    });
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center px-4">
      {/* Full-page background */}
      <div
        className="fixed inset-0 bg-cover bg-center bg-no-repeat"
        style={{ backgroundImage: "url('/images/auth-bg.png')" }}
      />
      {/* Dark overlay */}
      <div className="fixed inset-0 bg-black/60" />

      {/* Form */}
      <div className="relative z-10 w-full max-w-[400px]">
        <div className="mb-8 flex items-center justify-between">
          <a href="/" className="text-lg font-bold text-white">
            Moto<span style={{ color: palette.signature400 }}>Vault</span>
          </a>
          <a href="/" className="text-sm text-neutral-400 transition-colors hover:text-neutral-200">
            &larr; Home
          </a>
        </div>

        <h1 className="text-2xl font-bold text-white">Welcome back</h1>
        <p className="mt-1 text-sm text-neutral-400">Sign in to your account</p>

        {error && (
          <p id="login-error" role="alert" className="mt-4 text-sm text-red-400">
            {error}
          </p>
        )}

        {/* OAuth */}
        <div className="mt-6 flex flex-col gap-3">
          <button
            type="button"
            onClick={handleGoogleSignIn}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm font-medium text-white backdrop-blur-sm transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            {oauthLoading === 'google' ? <Spinner /> : <GoogleIcon />}
            {oauthLoading === 'google' ? 'Redirecting...' : 'Continue with Google'}
          </button>
          <button
            type="button"
            onClick={handleAppleSignIn}
            disabled={oauthLoading !== null}
            className="flex w-full items-center justify-center gap-3 rounded-lg bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-neutral-200 disabled:opacity-50"
          >
            {oauthLoading === 'apple' ? <Spinner /> : <AppleIcon />}
            {oauthLoading === 'apple' ? 'Redirecting...' : 'Continue with Apple'}
          </button>
        </div>

        {/* Divider */}
        <div className="my-6 flex items-center gap-4">
          <div className="h-px flex-1 bg-white/10" />
          <span className="text-xs text-neutral-500">or</span>
          <div className="h-px flex-1 bg-white/10" />
        </div>

        {/* Email form */}
        <form onSubmit={handleLogin} className="flex flex-col gap-4">
          <input
            id="login-email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            maxLength={255}
            required
            aria-describedby={error ? 'login-error' : undefined}
            className="rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 backdrop-blur-sm focus:border-white/20 focus:outline-none"
          />
          <div>
            <input
              id="login-password"
              type="password"
              placeholder="Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              maxLength={128}
              required
              aria-describedby={error ? 'login-error' : undefined}
              className="w-full rounded-lg border border-white/10 bg-white/5 px-4 py-3 text-sm text-white placeholder:text-neutral-500 backdrop-blur-sm focus:border-white/20 focus:outline-none"
            />
            <div className="mt-1.5 text-right">
              <Link
                href="/forgot-password"
                className="text-xs text-neutral-500 transition-colors hover:text-neutral-300"
              >
                Forgot password?
              </Link>
            </div>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="rounded-lg px-6 py-3 text-sm font-semibold text-white transition-colors hover:opacity-90 disabled:opacity-50"
            style={{ backgroundColor: palette.signature500 }}
          >
            {loading ? 'Signing in...' : 'Sign in'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-neutral-500">
          No account?{' '}
          <Link
            href="/signup"
            className="font-medium text-white transition-colors hover:text-neutral-300"
          >
            Sign up
          </Link>
        </p>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18A11.96 11.96 0 0 0 1 12c0 1.94.46 3.77 1.18 5.42l3.66-2.84z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

function AppleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.53-3.23 0-1.44.66-2.2.47-3.06-.4C3.79 16.17 4.36 9.53 8.7 9.28c1.25.07 2.12.72 2.86.76.98-.2 1.92-.78 2.98-.7 1.27.1 2.22.58 2.85 1.49-2.55 1.54-1.95 4.92.54 5.87-.65 1.7-1.49 3.38-2.88 4.58zM12.03 9.15C11.85 6.83 13.72 4.92 15.9 4.75c.3 2.66-2.4 4.65-3.87 4.4z" />
    </svg>
  );
}
