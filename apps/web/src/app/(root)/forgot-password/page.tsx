'use client';

import { useMemo, useState } from 'react';
import {
  AltLink,
  AuthBanner,
  AuthErrorRegion,
  AuthField,
  AuthHead,
  AuthNote,
  AuthShell,
  HOME_LABEL,
  SubmitButton,
} from '@/components/auth-ui/auth-ui';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/** Root-only route: English strings live here. */
const COPY = {
  title: 'Reset your password',
  subtitle: 'Enter the email on your account and we will send a link to set a new one.',
  emailLabel: 'Email',
  emailPlaceholder: 'you@example.com',
  submit: 'Send reset link',
  submitting: 'Sending link…',
  sentLead: 'We sent a reset link to',
  sentHint: 'Check your inbox and the spam folder. Nothing after a minute? Send it again.',
  sendAgain: 'Send it again',
  altPrompt: 'Remember it after all?',
  altCta: 'Sign in',
} as const;

export default function ForgotPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
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
      redirectTo: `${window.location.origin}/auth/callback?redirect=/reset-password`,
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
    <AuthShell headerLink={{ href: '/login', label: COPY.altCta }} homeLabel={HOME_LABEL}>
      <AuthHead title={COPY.title} subtitle={COPY.subtitle} />

      <AuthErrorRegion>{error && <AuthBanner message={error} />}</AuthErrorRegion>

      {success ? (
        <AuthNote>
          <p>
            {COPY.sentLead} <strong>{email}</strong>.
          </p>
          <p className="mva-note-small">{COPY.sentHint}</p>
          <button
            type="button"
            className="mv-link is-quiet is-tall"
            onClick={() => setSuccess(false)}
          >
            {COPY.sendAgain}
          </button>
        </AuthNote>
      ) : (
        <form className="mva-form" onSubmit={handleReset} autoComplete="on" noValidate>
          <AuthField
            id="reset-email"
            label={COPY.emailLabel}
            name="email"
            type="email"
            inputMode="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={COPY.emailPlaceholder}
            autoComplete="email"
            maxLength={255}
            required
          />
          <SubmitButton busy={loading} label={COPY.submit} busyLabel={COPY.submitting} />
        </form>
      )}

      <AltLink prompt={COPY.altPrompt} href="/login" label={COPY.altCta} />
    </AuthShell>
  );
}
