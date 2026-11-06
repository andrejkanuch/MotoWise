'use client';

import Link from 'next/link';
import { useMemo, useState } from 'react';
import {
  AuthBanner,
  AuthErrorRegion,
  AuthField,
  AuthHead,
  AuthNote,
  AuthShell,
  HOME_LABEL,
  SubmitButton,
} from '@/components/auth-ui/auth-ui';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

const MIN_PASSWORD_LENGTH = 6;

/** Root-only route: English strings live here. */
const COPY = {
  title: 'Choose a new password',
  subtitle: `At least ${MIN_PASSWORD_LENGTH} characters. You will stay signed in on this device.`,
  passwordLabel: 'New password',
  confirmLabel: 'Confirm new password',
  showPassword: 'Show password',
  hidePassword: 'Hide password',
  submit: 'Update password',
  submitting: 'Updating…',
  mismatch: 'Passwords do not match.',
  tooShort: `Password must be at least ${MIN_PASSWORD_LENGTH} characters.`,
  updated: 'Your password is updated.',
  signIn: 'Sign in with the new password',
  headerLink: 'Sign in',
} as const;

export default function ResetPasswordPage() {
  const supabase = useMemo(() => getSupabaseBrowserClient(), []);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;

    if (password !== confirmPassword) {
      setError(COPY.mismatch);
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setError(COPY.tooShort);
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

  const mismatch = error === COPY.mismatch;
  const toggle = {
    shown: showPassword,
    onToggle: () => setShowPassword(!showPassword),
    showLabel: COPY.showPassword,
    hideLabel: COPY.hidePassword,
  };

  return (
    <AuthShell headerLink={{ href: '/login', label: COPY.headerLink }} homeLabel={HOME_LABEL}>
      <AuthHead title={COPY.title} subtitle={COPY.subtitle} />

      <AuthErrorRegion>{error && !mismatch && <AuthBanner message={error} />}</AuthErrorRegion>

      {success ? (
        <AuthNote>
          <p>{COPY.updated}</p>
          <Link href="/login" className="mv-link is-quiet is-tall">
            {COPY.signIn}
          </Link>
        </AuthNote>
      ) : (
        <form className="mva-form" onSubmit={handleReset} autoComplete="on" noValidate>
          <AuthField
            id="new-password"
            label={COPY.passwordLabel}
            name="new-password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            required
            autoComplete="new-password"
            toggle={toggle}
          />
          <AuthField
            id="confirm-password"
            label={COPY.confirmLabel}
            name="confirm-password"
            type={showPassword ? 'text' : 'password'}
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            minLength={MIN_PASSWORD_LENGTH}
            maxLength={128}
            required
            autoComplete="new-password"
            error={mismatch ? error : undefined}
          />
          <SubmitButton busy={loading} label={COPY.submit} busyLabel={COPY.submitting} />
        </form>
      )}
    </AuthShell>
  );
}
