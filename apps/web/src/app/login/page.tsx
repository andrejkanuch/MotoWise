'use client';

import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useMemo, useState } from 'react';
import {
  AltLink,
  AuthBanner,
  AuthErrorRegion,
  AuthField,
  AuthHead,
  AuthShell,
  LegalNote,
  OAuthButtons,
  type OAuthProvider,
  OrWithEmail,
  RESEND_LABEL_KEY,
  SubmitButton,
  serifChunk,
} from '@/components/auth-ui/auth-ui';
import { identifyUser, trackEvent, WebEvent } from '@/lib/analytics';
import {
  type AuthErrorRecovery,
  EMPTY_FIELDS_MESSAGE,
  hasCredentials,
  humanizeAuthError,
  recoveryForAttempt,
} from '@/lib/auth-errors';
import { postAuthDestination, signUpEmailRedirectTo } from '@/lib/post-auth-redirect';

export default function LoginPage() {
  const t = useTranslations('AuthV2');
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
  const [recovery, setRecovery] = useState<AuthErrorRecovery>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [resendState, setResendState] = useState<'idle' | 'sending' | 'sent'>('idle');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!hasCredentials(email, password)) {
      setError(EMPTY_FIELDS_MESSAGE);
      setRecovery(null);
      return;
    }
    setLoading(true);
    setError('');
    setRecovery(null);
    setResendState('idle');
    trackEvent(WebEvent.SIGN_IN_SUBMITTED, { method: 'email' });
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) {
      const info = humanizeAuthError(error);
      const attempts = failedAttempts + 1;
      setFailedAttempts(attempts);
      setError(info.message);
      setRecovery(recoveryForAttempt(info, attempts));
      setLoading(false);
      trackEvent(WebEvent.SIGN_IN_ERROR, { method: 'email', error_message: error.message });
    } else {
      if (data.user) {
        identifyUser(data.user.id);
      }
      const params = new URLSearchParams(window.location.search);
      // First sign-in after confirming the email elsewhere → /welcome; else
      // ?redirect= or /garage, as before (lib/post-auth-redirect.ts).
      const redirectTo = postAuthDestination({ redirect: params.get('redirect'), user: data.user });
      window.location.href = redirectTo;
    }
  };

  const handleResendConfirmation = async () => {
    if (resendState === 'sending' || !email.trim()) return;
    setResendState('sending');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      // Same return path as the signup confirmation email: back through
      // /auth/callback, so a first session lands on /welcome.
      options: {
        emailRedirectTo: signUpEmailRedirectTo(
          window.location.origin,
          new URLSearchParams(window.location.search).get('redirect'),
        ),
      },
    });
    if (error) {
      setError(humanizeAuthError(error).message);
      setResendState('idle');
    } else {
      setResendState('sent');
    }
  };

  const handleGoogleSignIn = async () => {
    setOauthLoading('google');
    trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider: 'google' });
    await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/garage')}`,
      },
    });
  };

  const handleAppleSignIn = async () => {
    setOauthLoading('apple');
    trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider: 'apple' });
    await supabase.auth.signInWithOAuth({
      provider: 'apple',
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/garage')}`,
      },
    });
  };

  const recoveryAction: Record<NonNullable<AuthErrorRecovery>, React.ReactNode> = {
    reset_password: (
      <Link href="/forgot-password" className="mva-banner-link">
        {t('signIn.resetPassword')}
      </Link>
    ),
    resend_confirmation: (
      <button
        type="button"
        className="mva-btn-secondary"
        onClick={handleResendConfirmation}
        disabled={resendState !== 'idle'}
      >
        {t(RESEND_LABEL_KEY[resendState])}
      </button>
    ),
  };

  return (
    <AuthShell headerLink={{ href: '/signup', label: t('signIn.altCta') }}>
      <AuthHead
        eyebrow={t('signIn.eyebrow')}
        title={t.rich('signIn.title', { serif: serifChunk })}
        subtitle={t('signIn.subtitle')}
      />

      <AuthErrorRegion>
        {error && (
          <AuthBanner message={error} action={recovery ? recoveryAction[recovery] : undefined} />
        )}
      </AuthErrorRegion>

      <OAuthButtons
        loading={oauthLoading}
        onGoogle={handleGoogleSignIn}
        onApple={handleAppleSignIn}
      />

      <OrWithEmail />

      <form className="mva-form" onSubmit={handleLogin} autoComplete="on" noValidate>
        <AuthField
          id="login-email"
          label={t('emailLabel')}
          name="email"
          type="email"
          inputMode="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          autoComplete="email"
          maxLength={255}
          required
        />
        <AuthField
          id="login-password"
          label={t('passwordLabel')}
          labelAside={
            <Link href="/forgot-password" className="mva-label-link">
              {t('signIn.forgot')}
            </Link>
          }
          name="password"
          type={showPassword ? 'text' : 'password'}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          maxLength={128}
          required
          toggle={{ shown: showPassword, onToggle: () => setShowPassword(!showPassword) }}
        />
        <SubmitButton
          busy={loading}
          disabled={oauthLoading !== null}
          label={t('signIn.submit')}
          busyLabel={t('signIn.submitting')}
        />
      </form>

      <AltLink prompt={t('signIn.altPrompt')} href="/signup" label={t('signIn.altCta')} />

      <LegalNote />
    </AuthShell>
  );
}
