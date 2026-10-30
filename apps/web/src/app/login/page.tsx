'use client';

import { createBrowserClient } from '@supabase/ssr';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { useEffect, useMemo, useState } from 'react';
import {
  AltLink,
  AuthBanner,
  AuthErrorRegion,
  AuthField,
  AuthHead,
  AuthShell,
  LegalNote,
  mutedChunk,
  OAuthButtons,
  OAuthProvider,
  OrWithEmail,
  RESEND_LABEL_KEY,
  SubmitButton,
} from '@/components/auth-ui/auth-ui';
import { useOAuthRedirect } from '@/components/auth-ui/use-oauth-redirect';
import { identifyUser, trackEvent, WebEvent } from '@/lib/analytics';
import {
  type AuthErrorRecovery,
  EMPTY_FIELDS_MESSAGE,
  hasCredentials,
  humanizeAuthError,
  RESEND_COOLDOWN_MS,
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
  // Owns "Redirecting…": released on a provider error, a blocked redirect or a
  // bfcache return, so the buttons can never stick.
  const oauth = useOAuthRedirect((message) => {
    setError(message);
    setRecovery(null);
  });
  const [showPassword, setShowPassword] = useState(false);

  // A sent confirmation can still go missing: after the cooldown the button is
  // usable again for the same address.
  useEffect(() => {
    if (resendState !== 'sent') return;
    const timer = setTimeout(() => setResendState('idle'), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [resendState]);

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

  const handleOAuth = (provider: OAuthProvider) =>
    oauth.start(provider, () => {
      trackEvent(WebEvent.SIGN_IN_OAUTH_CLICKED, { provider });
      return supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/garage')}`,
        },
      });
    });

  const recoveryAction: Record<NonNullable<AuthErrorRecovery>, React.ReactNode> = {
    reset_password: (
      <Link href="/forgot-password" className="mv-link is-quiet is-tall">
        {t('signIn.resetPassword')}
      </Link>
    ),
    resend_confirmation: (
      <button
        type="button"
        className="mv-btn mv-btn-ghost"
        onClick={handleResendConfirmation}
        disabled={resendState !== 'idle'}
      >
        {t(RESEND_LABEL_KEY[resendState])}
      </button>
    ),
  };

  return (
    <AuthShell
      headerLink={{ href: '/signup', label: t('signIn.altCta') }}
      homeLabel={t('homeLabel')}
    >
      <AuthHead
        title={t.rich('signIn.title', { muted: mutedChunk })}
        subtitle={t('signIn.subtitle')}
      />

      <AuthErrorRegion>
        {error && (
          <AuthBanner message={error} action={recovery ? recoveryAction[recovery] : undefined} />
        )}
      </AuthErrorRegion>

      <OAuthButtons
        loading={oauth.provider}
        onGoogle={() => handleOAuth(OAuthProvider.Google)}
        onApple={() => handleOAuth(OAuthProvider.Apple)}
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
            <Link href="/forgot-password" className="mv-link is-quiet is-tall">
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
          toggle={{
            shown: showPassword,
            onToggle: () => setShowPassword(!showPassword),
            showLabel: t('showPassword'),
            hideLabel: t('hidePassword'),
          }}
        />
        <SubmitButton
          busy={loading}
          disabled={oauth.provider !== null}
          label={t('signIn.submit')}
          busyLabel={t('signIn.submitting')}
        />
      </form>

      <AltLink prompt={t('signIn.altPrompt')} href="/signup" label={t('signIn.altCta')} />

      <LegalNote />
    </AuthShell>
  );
}
