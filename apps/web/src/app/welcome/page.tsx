import { Bell, Camera, type LucideIcon, Mail, Route } from 'lucide-react';
import type { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { NextIntlClientProvider } from 'next-intl';
import { getMessages, getTranslations } from 'next-intl/server';
import {
  APP_HANDOFF_URL,
  AppleMark,
  CopyLinkField,
  GoogleMark,
  GooglePlayMark,
  type HandoffAccount,
  QrCode,
  QrSize,
  SignInMethod,
  SignInText,
  signInMethodFromProvider,
} from '@/components/garage-ui';
import { mvFontsClassName } from '@/lib/fonts';
import { DEFAULT_POST_AUTH_PATH, WELCOME_PATH } from '@/lib/post-auth-redirect';
import { getSupabaseServerClient } from '@/lib/supabase-server';
import './welcome.css';

/**
 * Post-signup "Get the app" screen (spec: Handoff-1440/768/390).
 *
 * Reached from `postAuthDestination` (lib/post-auth-redirect.ts) on a rider's
 * first session; a returning sign-in goes to /garage. Auth-gated twice: by the
 * proxy (PROTECTED_PREFIXES) and here. Display-only: every action opens
 * https://motovault.app/get, which sends a phone to its store; the only other
 * link continues to the web garage. No loading.tsx may sit above this route:
 * it calls redirect().
 */

export async function generateMetadata(): Promise<Metadata> {
  const t = await getTranslations('Welcome');
  return { title: t('metaTitle'), robots: { index: false, follow: false } };
}

/** The three things only the app can do, in the spec's order. */
const REASONS: ReadonlyArray<{
  icon: LucideIcon;
  title: 'ridesTitle' | 'remindersTitle' | 'receiptsTitle';
  tag: 'ridesTag' | 'remindersTag' | 'receiptsTag';
}> = [
  { icon: Route, title: 'ridesTitle', tag: 'ridesTag' },
  { icon: Bell, title: 'remindersTitle', tag: 'remindersTag' },
  { icon: Camera, title: 'receiptsTitle', tag: 'receiptsTag' },
];

function SignInIcon({ method }: { method: SignInMethod }) {
  if (method === SignInMethod.Google) return <GoogleMark size={16} />;
  if (method === SignInMethod.Apple) return <AppleMark size={16} />;
  return <Mail size={16} strokeWidth={1.75} aria-hidden="true" />;
}

/** "Sign in with the same account: …" with the method's icon in a round tile. */
function AccountLine({ account, className }: { account: HandoffAccount; className: string }) {
  return (
    <p className={`wl-signin ${className}`}>
      <span className="wl-signin-icon" aria-hidden="true">
        <SignInIcon method={account.method} />
      </span>
      <span>
        <SignInText account={account} />
      </span>
    </p>
  );
}

export default async function WelcomePage() {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect(`/login?redirect=${encodeURIComponent(WELCOME_PATH)}`);
  }

  const [t, tHandoff, messages] = await Promise.all([
    getTranslations('Welcome'),
    getTranslations('AppHandoff'),
    getMessages(),
  ]);
  const account: HandoffAccount = {
    method: signInMethodFromProvider(user.app_metadata?.provider),
    email: user.email ?? null,
  };
  const serif = (chunks: React.ReactNode) => <span className="mvg-serif wl-serif">{chunks}</span>;
  const bold = (chunks: React.ReactNode) => <strong>{chunks}</strong>;

  return (
    <NextIntlClientProvider messages={messages}>
      <div className={`${mvFontsClassName} wl-page mvg-scope`}>
        <header className="wl-header">
          <a href="/" className="wl-brand" aria-label={t('homeLabel')}>
            <span className="wl-brand-mark" aria-hidden="true">
              M
            </span>
            MotoVault
          </a>
          {account.email && (
            <p className="wl-signed-in">
              {t.rich('signedInAs', { email: account.email, b: bold })}
            </p>
          )}
        </header>

        <main className="wl-main">
          <div className="wl-lead">
            <div className="wl-intro">
              <p className="wl-eyebrow">{t('eyebrow')}</p>
              <h1 className="wl-title">{t.rich('title', { serif })}</h1>
            </div>

            <ol className="wl-reasons" aria-label={t('reasonsLabel')}>
              {REASONS.map(({ icon: Icon, title, tag }, index) => (
                <li key={title} className="wl-reason">
                  <span className="wl-reason-num" aria-hidden="true">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <span className="wl-reason-icon" aria-hidden="true">
                    <Icon strokeWidth={1.75} />
                  </span>
                  <span className="wl-reason-title">{t(title)}</span>
                  <span className="wl-reason-tag">{t(tag)}</span>
                </li>
              ))}
            </ol>

            <a href={DEFAULT_POST_AUTH_PATH} className="wl-continue">
              {t('continue')}
            </a>
          </div>

          {/* ≥ 768: the QR card. A phone cannot scan its own screen, so < 768
              swaps it for the button below (CSS). */}
          <section className="wl-card" aria-labelledby="wl-qr-title">
            <div className="wl-card-row">
              <QrCode size={QrSize.Spotlight} label={tHandoff('qrAlt')} />
              <div className="wl-card-text">
                <div className="wl-card-copy">
                  <h2 id="wl-qr-title" className="wl-card-title">
                    {t('qrTitle')}
                  </h2>
                  <p className="wl-card-body">{t('qrBody')}</p>
                </div>
                <CopyLinkField className="wl-linkfield" />
              </div>
            </div>
            <AccountLine account={account} className="wl-signin--card" />
          </section>

          {/* < 768: one button to motovault.app/get (it opens the phone's own
              store), then the account line. */}
          <section className="wl-phone" aria-label={t('getAppLabel')}>
            <a href={APP_HANDOFF_URL} className="wl-get" aria-label={t('getAppLabel')}>
              <AppleMark size={20} />
              <GooglePlayMark size={18} />
              {t('getApp')}
            </a>
            <AccountLine account={account} className="wl-signin--box" />
          </section>
        </main>
      </div>
    </NextIntlClientProvider>
  );
}
