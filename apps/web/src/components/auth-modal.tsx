'use client';

import { useCallback, useRef, useState } from 'react';
import {
  AuthBanner,
  AuthErrorRegion,
  AuthField,
  AuthNote,
  type OAuthProvider,
  Spinner,
  SubmitButton,
} from '@/components/auth-ui/auth-ui';
import { readExplicitConsent } from '@/components/cookie-consent';
import { AppleMark, GoogleMark } from '@/components/garage-ui/brand-icons';
import { useModal } from '@/hooks/use-modal';
import {
  type AuthErrorRecovery,
  EMPTY_FIELDS_MESSAGE,
  hasCredentials,
  humanizeAuthError,
  recoveryForAttempt,
} from '@/lib/auth-errors';
import { signUpConsentOptions } from '@/lib/signup-consent';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  /** What the user was trying to do — shown in the modal title */
  action?: string;
}

type Mode = 'signin' | 'signup';
type ResendState = 'idle' | 'sending' | 'sent';

/**
 * English-only: the modal sits on root routes (trip pages) without an intl
 * provider. The wording mirrors the AuthV2 catalogue (/login, /signup).
 */
const COPY = {
  signin: {
    heading: 'Sign in',
    submit: 'Sign in',
    submitting: 'Signing in…',
    altPrompt: 'No account yet?',
    altCta: 'Create account',
    emptyFields: EMPTY_FIELDS_MESSAGE,
  },
  signup: {
    heading: 'Create account',
    submit: 'Create account',
    submitting: 'Creating account…',
    altPrompt: 'Already have an account?',
    altCta: 'Sign in',
    emptyFields: 'Enter your email and password to create an account.',
  },
} as const satisfies Record<Mode, Record<string, string>>;

const RESEND_LABEL: Record<ResendState, string> = {
  idle: 'Resend confirmation email',
  sending: 'Sending…',
  sent: 'Confirmation email sent — check your inbox.',
};

const CONFIRMATION_SENT =
  'We sent a confirmation link to your email. Open it to finish signing up.';

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
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [recovery, setRecovery] = useState<AuthErrorRecovery>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [resendState, setResendState] = useState<ResendState>('idle');
  const [info, setInfo] = useState('');
  const [loading, setLoading] = useState(false);
  const [oauthLoading, setOauthLoading] = useState<OAuthProvider | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const dialogRef = useRef<HTMLDivElement>(null);

  useModal(open, onClose, dialogRef);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (loading) return;
      if (!hasCredentials(email, password)) {
        setError(COPY[mode].emptyFields);
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
        const { data, error } = await supabase.auth.signUp({
          email: email.trim(),
          password,
          options: signUpConsentOptions(readExplicitConsent()),
        });
        if (error) {
          setError(humanizeAuthError(error).message);
          setLoading(false);
        } else if (data.user && !data.session) {
          setInfo(CONFIRMATION_SENT);
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

  const handleOAuth = useCallback(async (provider: OAuthProvider) => {
    setOauthLoading(provider);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/auth/callback?redirect=${encodeURIComponent(window.location.pathname)}`,
      },
    });
  }, []);

  const switchMode = (next: Mode) => {
    setMode(next);
    setError('');
    setInfo('');
    setRecovery(null);
    setResendState('idle');
  };

  if (!open) return null;

  const copy = COPY[mode];
  const recoveryAction: Record<NonNullable<AuthErrorRecovery>, React.ReactNode> = {
    reset_password: (
      <a href="/forgot-password" className="mv-link is-quiet is-tall">
        Reset your password
      </a>
    ),
    resend_confirmation: (
      <button
        type="button"
        className="mv-btn mv-btn-ghost"
        onClick={handleResendConfirmation}
        disabled={resendState !== 'idle'}
      >
        {RESEND_LABEL[resendState]}
      </button>
    ),
  };
  const providers = [
    { id: 'google', label: 'Continue with Google', icon: <GoogleMark size={16} /> },
    { id: 'apple', label: 'Continue with Apple', icon: <AppleMark size={16} /> },
  ] as const;

  return (
    <div
      className="mv-root mva-modal-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onKeyDown={() => {}}
      role="dialog"
      aria-modal="true"
      aria-labelledby="auth-modal-title"
    >
      <div ref={dialogRef} tabIndex={-1} className="mva-modal">
        <h2 id="auth-modal-title" className="mva-modal-title">
          {copy.heading} to {action}
        </h2>

        <AuthErrorRegion>
          {error && (
            <AuthBanner message={error} action={recovery ? recoveryAction[recovery] : undefined} />
          )}
          {info && (
            <AuthNote>
              <p>{info}</p>
            </AuthNote>
          )}
        </AuthErrorRegion>

        <div className="mva-oauth">
          {providers.map((p) => {
            const busy = oauthLoading === p.id;
            return (
              <button
                key={p.id}
                type="button"
                className="mv-btn mv-btn-ghost mv-btn-block"
                onClick={() => handleOAuth(p.id)}
                disabled={oauthLoading !== null}
                aria-busy={busy || undefined}
              >
                {busy ? (
                  <>
                    <Spinner />
                    Redirecting…
                  </>
                ) : (
                  <>
                    {p.icon}
                    <span className="mva-oauth-long">{p.label}</span>
                  </>
                )}
              </button>
            );
          })}
        </div>

        <div className="mva-divider">or with email</div>

        <form onSubmit={handleSubmit} className="mva-form" autoComplete="on" noValidate>
          <AuthField
            id="auth-email"
            label="Email"
            name="email"
            type="email"
            inputMode="email"
            placeholder="you@example.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            maxLength={255}
          />
          <AuthField
            id="auth-password"
            label="Password"
            name="password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete={mode === 'signin' ? 'current-password' : 'new-password'}
            minLength={6}
            maxLength={128}
            hint={mode === 'signup' ? 'At least 6 characters' : undefined}
            toggle={{
              shown: showPassword,
              onToggle: () => setShowPassword(!showPassword),
              showLabel: 'Show password',
              hideLabel: 'Hide password',
            }}
          />
          <SubmitButton
            busy={loading}
            disabled={oauthLoading !== null}
            label={copy.submit}
            busyLabel={copy.submitting}
          />
        </form>

        <div className="mva-alt">
          {copy.altPrompt}
          <button
            type="button"
            className="mv-link is-quiet is-tall"
            onClick={() => switchMode(mode === 'signin' ? 'signup' : 'signin')}
          >
            {copy.altCta}
          </button>
        </div>
      </div>
    </div>
  );
}
