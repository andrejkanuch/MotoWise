'use client';

import { Check, Copy, Mail } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect, useRef, useState } from 'react';
import { AppleMark, GoogleMark } from './brand-icons';
import { APP_HANDOFF_DISPLAY, APP_HANDOFF_URL, type HandoffAccount, SignInMethod } from './handoff';
import { QrCode, QrSize } from './qr-code';
import './garage-ui.css';

/** How long the Copy button reads "Copied" (spec: reverts after 2 s). */
const COPIED_RESET_MS = 2000;

/**
 * The link field: `motovault.app/get` (a real link) + a 44px Copy button.
 * Copied state: the button reads "Copied" and a polite live region announces
 * it; it reverts after 2 s.
 */
export function CopyLinkField({ className }: { className?: string }) {
  const t = useTranslations('AppHandoff');
  const [copied, setCopied] = useState(false);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    [],
  );

  async function copy() {
    try {
      await navigator.clipboard.writeText(APP_HANDOFF_URL);
    } catch {
      // Clipboard blocked (permissions, insecure context): the visible link
      // still works, so fail quietly rather than claim a copy.
      return;
    }
    setCopied(true);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopied(false), COPIED_RESET_MS);
  }

  return (
    <div className={className ? `mvg-linkfield ${className}` : 'mvg-linkfield'}>
      <a href={APP_HANDOFF_URL} className="mvg-linkfield-url">
        {APP_HANDOFF_DISPLAY}
      </a>
      <button type="button" className="mvg-copy" aria-label={t('copyLabel')} onClick={copy}>
        {copied ? (
          <Check size={14} strokeWidth={2} aria-hidden="true" />
        ) : (
          <Copy size={14} strokeWidth={2} aria-hidden="true" />
        )}
        {copied ? t('copied') : t('copy')}
      </button>
      <span className="mvg-sr-only" aria-live="polite">
        {copied ? t('linkCopied') : ''}
      </span>
    </div>
  );
}

/**
 * "Sign in with the same account" copy, by sign-up method:
 * email → names the address; Google/Apple → names the button to tap.
 * Inline text only; see {@link SignInHint} for the bordered row with an icon.
 */
export function SignInText({ account }: { account: HandoffAccount }) {
  const t = useTranslations('AppHandoff');
  const bold = (chunks: React.ReactNode) => <strong>{chunks}</strong>;
  if (account.method === SignInMethod.Google) return <>{t.rich('signInGoogle', { b: bold })}</>;
  if (account.method === SignInMethod.Apple) return <>{t.rich('signInApple', { b: bold })}</>;
  if (!account.email) return <>{t('signInSameAccountNoEmail')}</>;
  return <>{t.rich('signInSameAccount', { email: account.email, b: bold })}</>;
}

/** The bordered account line (icon + {@link SignInText}), e.g. on the handoff page. */
export function SignInHint({ account }: { account: HandoffAccount }) {
  const icon =
    account.method === SignInMethod.Google ? (
      <GoogleMark size={18} />
    ) : account.method === SignInMethod.Apple ? (
      <AppleMark size={18} />
    ) : (
      <Mail size={18} strokeWidth={1.75} aria-hidden="true" />
    );
  return (
    <p className="mvg-signin" style={{ margin: 0 }}>
      {icon}
      <span>
        <SignInText account={account} />
      </span>
    </p>
  );
}

export const QrHandoffVariant = {
  /** Desktop rail: 112 QR beside the text, link field below. */
  Rail: 'rail',
  /** Tablet band: 104 QR, tighter gap. */
  Band: 'band',
  /** Empty-garage hero: 148 QR, larger text, link field inside the text column. */
  Hero: 'hero',
} as const;
export type QrHandoffVariant = (typeof QrHandoffVariant)[keyof typeof QrHandoffVariant];

const QR_SIZE_FOR_VARIANT: Record<QrHandoffVariant, QrSize> = {
  [QrHandoffVariant.Rail]: QrSize.Rail,
  [QrHandoffVariant.Band]: QrSize.Band,
  [QrHandoffVariant.Hero]: QrSize.Hero,
};

/**
 * QR tile + "Scan to open MotoVault" + the sign-in line + the copy-link field.
 * The QR encodes https://motovault.app/get, which sends a phone to its store.
 */
export function QrHandoff({
  account,
  variant = QrHandoffVariant.Rail,
}: {
  account: HandoffAccount;
  variant?: QrHandoffVariant;
}) {
  const t = useTranslations('AppHandoff');
  const isHero = variant === QrHandoffVariant.Hero;
  return (
    <div className={`mvg-qrh mvg-qrh--${variant}`}>
      <div className="mvg-qrh-row">
        <QrCode size={QR_SIZE_FOR_VARIANT[variant]} label={t('qrAlt')} />
        <div className="mvg-qrh-text">
          <p className="mvg-qrh-title">{t('scanToOpen')}</p>
          <p className="mvg-qrh-body">
            <SignInText account={account} />
          </p>
          {isHero && <CopyLinkField />}
        </div>
      </div>
      {!isHero && <CopyLinkField />}
    </div>
  );
}
