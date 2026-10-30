'use client';

import { createBrowserClient } from '@supabase/ssr';
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
  MailIcon,
  mutedChunk,
  OAuthButtons,
  OAuthProvider,
  OrWithEmail,
  RESEND_LABEL_KEY,
  type ResendState,
  SubmitButton,
} from '@/components/auth-ui/auth-ui';
import { useOAuthRedirect } from '@/components/auth-ui/use-oauth-redirect';
import { readExplicitConsent } from '@/components/cookie-consent';
import { identifyUser, trackEvent, WebEvent } from '@/lib/analytics';
import {
  hasCredentials,
  humanizeAuthError,
  RESEND_COOLDOWN_MS,
  SIGNUP_EMPTY_FIELDS_MESSAGE,
} from '@/lib/auth-errors';
import { postAuthDestination, signUpEmailRedirectTo } from '@/lib/post-auth-redirect';
import { signUpConsentOptions } from '@/lib/signup-consent';

/** Client-side check message; shown on the confirm field instead of the banner. */
const PASSWORD_MISMATCH_MESSAGE = 'Passwords do not match.';
export default function SignUpPage() {
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
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  // Owns "Redirecting…": released on a provider error, a blocked redirect or a
  // bfcache return, so the buttons can never stick.
  const oauth = useOAuthRedirect(setError);
  const [showPassword, setShowPassword] = useState(false);
  const [resendState, setResendState] = useState<ResendState>('idle');

  // A sent confirmation can still go missing: after the cooldown the button is
  // usable again for the same address.
  useEffect(() => {
    if (resendState !== 'sent') return;
    const timer = setTimeout(() => setResendState('idle'), RESEND_COOLDOWN_MS);
    return () => clearTimeout(timer);
  }, [resendState]);

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    if (!hasCredentials(email, password)) {
      setError(SIGNUP_EMPTY_FIELDS_MESSAGE);
      return;
    }
    if (password !== confirmPassword) {
      setError(PASSWORD_MISMATCH_MESSAGE);
      return;
    }
    setLoading(true);
    setError('');
    trackEvent(WebEvent.SIGN_UP_SUBMITTED, { method: 'email' });
    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: {
        ...signUpConsentOptions(readExplicitConsent()),
        // The confirmation link returns through /auth/callback, which sends a
        // first session to /welcome (lib/post-auth-redirect.ts).
        emailRedirectTo: signUpEmailRedirectTo(
          window.location.origin,
          new URLSearchParams(window.location.search).get('redirect'),
        ),
      },
    });
    if (error) {
      setError(error.message);
      setLoading(false);
      trackEvent(WebEvent.SIGN_UP_ERROR, { method: 'email', error_message: error.message });
    } else if (data.user && !data.session) {
      identifyUser(data.user.id);
      setSuccess(true);
      setLoading(false);
    } else {
      if (data.user) {
        identifyUser(data.user.id);
      }
      const params = new URLSearchParams(window.location.search);
      // Signed in at once (confirmations off): first session → /welcome.
      window.location.href = postAuthDestination({
        redirect: params.get('redirect'),
        user: data.user,
      });
    }
  };

  const handleOAuth = (provider: OAuthProvider) =>
    oauth.start(provider, () => {
      trackEvent(WebEvent.SIGN_UP_OAUTH_CLICKED, { provider });
      return supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(new URLSearchParams(window.location.search).get('redirect') || '/garage')}`,
        },
      });
    });

  const handleResendConfirmation = async () => {
    if (resendState === 'sending' || !email.trim()) return;
    setResendState('sending');
    const { error } = await supabase.auth.resend({
      type: 'signup',
      email: email.trim(),
      // Same return path as the original confirmation email (see signUp above).
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

  const handleDifferentEmail = () => {
    setSuccess(false);
    setError('');
    setResendState('idle');
  };

  const mismatch = error === PASSWORD_MISMATCH_MESSAGE;
  const bannerError = mismatch ? '' : error;

  return (
    <AuthShell
      headerLink={{ href: '/login', label: t('signUp.altCta') }}
      homeLabel={t('homeLabel')}
    >
      <AuthHead
        title={t.rich('signUp.title', { muted: mutedChunk })}
        subtitle={t('signUp.subtitle')}
      />

      <AuthErrorRegion>{bannerError && <AuthBanner message={bannerError} />}</AuthErrorRegion>

      {success ? (
        <div role="status" className="mva-check">
          <div className="mva-check-copy">
            <h2 className="mva-check-title">
              <MailIcon />
              <span>{t.rich('checkEmail.title', { muted: mutedChunk })}</span>
            </h2>
            <p className="mva-check-body">{t('checkEmail.body')}</p>
            <p className="mva-check-email">{email.trim()}</p>
          </div>
          <div className="mva-check-foot">
            {t('checkEmail.nothingArrived')}
            <button
              type="button"
              className="mv-btn mv-btn-ghost"
              onClick={handleResendConfirmation}
              disabled={resendState !== 'idle'}
            >
              {t(RESEND_LABEL_KEY[resendState])}
            </button>
            <button
              type="button"
              className="mv-link is-quiet is-tall"
              onClick={handleDifferentEmail}
            >
              {t('checkEmail.differentEmail')}
            </button>
          </div>
        </div>
      ) : (
        <>
          <OAuthButtons
            loading={oauth.provider}
            onGoogle={() => handleOAuth(OAuthProvider.Google)}
            onApple={() => handleOAuth(OAuthProvider.Apple)}
          />

          <OrWithEmail />

          <form className="mva-form" onSubmit={handleSignUp} autoComplete="on" noValidate>
            <AuthField
              id="signup-email"
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
              id="signup-password"
              label={t('passwordLabel')}
              name="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              hint={t('signUp.passwordHint')}
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              required
              toggle={{
                shown: showPassword,
                onToggle: () => setShowPassword(!showPassword),
                showLabel: t('showPassword'),
                hideLabel: t('hidePassword'),
              }}
            />
            <AuthField
              id="signup-confirm-password"
              label={t('signUp.confirmPasswordLabel')}
              name="confirm-password"
              type={showPassword ? 'text' : 'password'}
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              autoComplete="new-password"
              minLength={6}
              maxLength={128}
              required
              error={mismatch ? error : undefined}
            />
            <SubmitButton
              busy={loading}
              disabled={oauth.provider !== null}
              label={t('signUp.submit')}
              busyLabel={t('signUp.submitting')}
            />
          </form>

          <LegalNote />
        </>
      )}

      <AltLink prompt={t('signUp.altPrompt')} href="/login" label={t('signUp.altCta')} />
    </AuthShell>
  );
}
