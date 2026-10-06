'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import type { InputHTMLAttributes, ReactNode } from 'react';
import { AppleMark, GoogleMark } from '@/components/garage-ui/brand-icons';
import './auth-ui.css';

/**
 * Presentational pieces of the redesigned /login and /signup ("Auth"
 * artboards). They hold no auth logic: the pages own Supabase, analytics and
 * redirects and pass state in.
 */

/** OAuth providers offered on both auth pages. */
export const OAuthProvider = {
  Google: 'google',
  Apple: 'apple',
} as const;
export type OAuthProvider = (typeof OAuthProvider)[keyof typeof OAuthProvider];

/** State of a "Resend confirmation email" button. */
export type ResendState = 'idle' | 'sending' | 'sent';

/** AuthV2 message key for each resend state. */
export const RESEND_LABEL_KEY = {
  idle: 'resendConfirmation',
  sending: 'resendSending',
  sent: 'resendSent',
} as const satisfies Record<ResendState, string>;

const HERO_PHOTO = '/images/marketing/hero-dusk-ride-portrait.jpg';
const BRAND_LOGO = '/images/marketing/MotoVault.png';

function Brand() {
  const t = useTranslations('AuthV2');
  return (
    <a href="/" className="mva-brand" aria-label={t('homeLabel')}>
      <span className="mva-brand-logo">
        <Image src={BRAND_LOGO} alt="" width={24} height={24} />
      </span>
      MotoVault
    </a>
  );
}

type AuthShellProps = {
  /** Link in the phone/tablet header bar (the other auth page). */
  headerLink: { href: string; label: string };
  children: ReactNode;
};

/**
 * Page frame: photo panel + 640 form column at ≥1024, header bar + centred
 * form below. The photo is decorative (the brand's own marketing shot).
 */
export function AuthShell({ headerLink, children }: AuthShellProps) {
  return (
    <div className="mva-root">
      <div className="mva-panel">
        {/* `fill` needs a relative/absolute/fixed parent; the panel is sticky
            (and static while hidden), which next/image warns about on every load. */}
        <div className="mva-panel-media">
          <Image
            src={HERO_PHOTO}
            alt=""
            fill
            priority
            sizes="(min-width: 1024px) calc(100vw - 640px), 1px"
            className="mva-panel-photo"
          />
        </div>
        <Brand />
      </div>
      <header className="mva-header">
        <Brand />
        <Link href={headerLink.href} className="mva-header-link">
          {headerLink.label}
        </Link>
      </header>
      <main className="mva-main">
        <div className="mva-stack">{children}</div>
      </main>
    </div>
  );
}

type AuthHeadProps = {
  eyebrow: string;
  title: ReactNode;
  subtitle: string;
};

export function AuthHead({ eyebrow, title, subtitle }: AuthHeadProps) {
  return (
    <div className="mva-head">
      <div className="mva-eyebrow">{eyebrow}</div>
      <h1 className="mva-title">{title}</h1>
      <p className="mva-subtitle">{subtitle}</p>
    </div>
  );
}

/** Rich-text tag renderer for `<serif>…</serif>` in AuthV2 titles. */
export function serifChunk(chunks: ReactNode) {
  return <span className="mva-serif">{chunks}</span>;
}

export function AlertIcon({ size = 18 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <circle cx="12" cy="12" r="10" />
      <path d="M12 8v4" />
      <path d="M12 16h.01" />
    </svg>
  );
}

export function Spinner({ size = 16 }: { size?: number }) {
  return (
    <svg
      className="mva-spinner"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.5"
      strokeLinecap="round"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.22-8.56" />
    </svg>
  );
}

/**
 * Polite live region above the form. Always rendered so screen readers pick
 * up the banner when it appears.
 */
export function AuthErrorRegion({ children }: { children: ReactNode }) {
  return (
    <div className="mva-live" aria-live="polite" aria-atomic="true">
      {children}
    </div>
  );
}

type AuthBannerProps = {
  message: string;
  /** Recovery link or button under the message. */
  action?: ReactNode;
};

export function AuthBanner({ message, action }: AuthBannerProps) {
  return (
    <div role="alert" className="mva-banner">
      <span className="mva-banner-icon">
        <AlertIcon />
      </span>
      <span className={action ? 'mva-banner-body mva-banner-body--actions' : 'mva-banner-body'}>
        <span>{message}</span>
        {action}
      </span>
    </div>
  );
}

type OAuthButtonsProps = {
  loading: OAuthProvider | null;
  onGoogle: () => void;
  onApple: () => void;
};

/** Google + Apple. Side by side at ≥768, stacked "Continue with …" below. */
export function OAuthButtons({ loading, onGoogle, onApple }: OAuthButtonsProps) {
  const t = useTranslations('AuthV2');
  const providers = [
    {
      id: OAuthProvider.Google,
      onClick: onGoogle,
      icon: <GoogleMark size={16} />,
      short: t('google'),
      long: t('continueWithGoogle'),
    },
    {
      id: OAuthProvider.Apple,
      onClick: onApple,
      icon: <AppleMark size={16} />,
      short: t('apple'),
      long: t('continueWithApple'),
    },
  ];
  return (
    <div className="mva-oauth">
      {providers.map((p) => {
        const busy = loading === p.id;
        return (
          <button
            key={p.id}
            type="button"
            className="mva-oauth-btn"
            onClick={p.onClick}
            disabled={loading !== null}
            aria-busy={busy || undefined}
          >
            {busy ? (
              <>
                <Spinner />
                {t('redirecting')}
              </>
            ) : (
              <>
                {p.icon}
                <span className="mva-oauth-short">{p.short}</span>
                <span className="mva-oauth-long">{p.long}</span>
              </>
            )}
          </button>
        );
      })}
    </div>
  );
}

export function OrWithEmail() {
  const t = useTranslations('AuthV2');
  return <div className="mva-divider">{t('orWithEmail')}</div>;
}

type AuthFieldProps = Omit<InputHTMLAttributes<HTMLInputElement>, 'className'> & {
  id: string;
  label: string;
  /** Element beside the label (e.g. "Forgot?"). */
  labelAside?: ReactNode;
  /** Field-level error, linked with aria-describedby + aria-invalid. */
  error?: string;
  /** Show/hide toggle inside the field (password fields). */
  toggle?: { shown: boolean; onToggle: () => void };
};

export function AuthField({ id, label, labelAside, error, toggle, ...input }: AuthFieldProps) {
  const t = useTranslations('AuthV2');
  const errorId = `${id}-error`;
  const labelEl = (
    <label htmlFor={id} className="mva-label">
      {label}
    </label>
  );
  return (
    <div className={labelAside ? 'mva-field mva-field--row' : 'mva-field'}>
      {labelAside ? (
        <div className="mva-label-row">
          {labelEl}
          {labelAside}
        </div>
      ) : (
        labelEl
      )}
      <div className="mva-input-wrap">
        <input
          id={id}
          className={toggle ? 'mva-input mva-input--toggle' : 'mva-input'}
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? errorId : undefined}
          {...input}
        />
        {toggle && (
          <button
            type="button"
            className="mva-toggle"
            onClick={toggle.onToggle}
            aria-label={toggle.shown ? t('hidePassword') : t('showPassword')}
            aria-pressed={toggle.shown}
          >
            {toggle.shown ? <EyeOffIcon /> : <EyeIcon />}
          </button>
        )}
      </div>
      {error && (
        <span id={errorId} role="alert" className="mva-field-error">
          <AlertIcon size={14} />
          {error}
        </span>
      )}
    </div>
  );
}

type SubmitButtonProps = {
  busy: boolean;
  disabled?: boolean;
  label: string;
  busyLabel: string;
};

export function SubmitButton({ busy, disabled, label, busyLabel }: SubmitButtonProps) {
  return (
    <button
      type="submit"
      className="mva-submit"
      disabled={busy || disabled}
      aria-busy={busy || undefined}
    >
      {busy && <Spinner />}
      {busy ? busyLabel : label}
    </button>
  );
}

export function LegalNote() {
  const t = useTranslations('AuthV2');
  return (
    <p className="mva-legal">
      {t.rich('legal', {
        terms: (chunks) => <a href="/terms">{chunks}</a>,
        privacy: (chunks) => <a href="/privacy">{chunks}</a>,
      })}
    </p>
  );
}

type AltLinkProps = { prompt: string; href: string; label: string };

/** "Already a rider? Sign in" / "No account yet? Create account". */
export function AltLink({ prompt, href, label }: AltLinkProps) {
  return (
    <div className="mva-alt">
      {prompt}
      <Link href={href} className="mva-alt-link">
        {label}
      </Link>
    </div>
  );
}

function EyeIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2.06 12.35a1 1 0 0 1 0-.7 10.75 10.75 0 0 1 19.88 0 1 1 0 0 1 0 .7 10.75 10.75 0 0 1-19.88 0" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  );
}

function EyeOffIcon() {
  return (
    <svg
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c4.97 0 8.5 4 9.94 6.65a1 1 0 0 1 0 .7 13.2 13.2 0 0 1-1.67 2.68" />
      <path d="M6.61 6.61A13.53 13.53 0 0 0 2.06 11.65a1 1 0 0 0 0 .7C3.5 15 7.03 19 12 19a9.74 9.74 0 0 0 5.39-1.61" />
      <path d="M14.08 14.16a3 3 0 0 1-4.24-4.24" />
      <path d="m2 2 20 20" />
    </svg>
  );
}

export function MailIcon() {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="2" y="4" width="20" height="16" rx="2" />
      <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
    </svg>
  );
}
