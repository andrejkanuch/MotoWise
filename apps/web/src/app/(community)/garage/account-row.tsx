'use client';

import { ArrowUpRight } from 'lucide-react';
import Link from 'next/link';
import { useTranslations } from 'next-intl';
import { type HandoffAccount, SignInMethod, Skeleton } from '@/components/garage-ui';
import { useManageSubscription } from '@/hooks/use-manage-subscription';
import { useProStatus } from '@/hooks/use-pro-status';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { AppStoreKind, STORE_SUBSCRIPTIONS_URL } from '@/lib/manage-subscription';
import { ManageWebSubscription } from '../profile/manage-web-subscription';

const SIGNED_IN_KEY = {
  [SignInMethod.Email]: 'signedInEmail',
  [SignInMethod.Google]: 'signedInGoogle',
  [SignInMethod.Apple]: 'signedInApple',
} as const;

const STORE_MANAGE_KEY = {
  [AppStoreKind.AppStore]: 'manageAppStore',
  [AppStoreKind.PlayStore]: 'manageGooglePlay',
} as const;

/** An external link that opens in a new tab and says so to screen readers. */
function ExternalManageLink({ href, children }: { href: string; children: string }) {
  const t = useTranslations('GarageV2');
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mvg-link"
      onClick={() => trackEvent(WebEvent.MANAGE_SUBSCRIPTION_CLICKED)}
    >
      {children}
      <ArrowUpRight size={14} strokeWidth={2} aria-hidden="true" />
      <span className="mvg-sr-only">{t('newTab')}</span>
    </a>
  );
}

/**
 * How this Pro rider manages the subscription, by billing source:
 * web (RevenueCat URL) → link; web (Stripe, no URL) → billing-portal session
 * (#274); App Store / Google Play → that store's subscriptions page; store
 * unknown → generic copy. Nothing while it resolves.
 */
function ManageLink() {
  const t = useTranslations('GarageV2');
  const manage = useManageSubscription();
  switch (manage.status) {
    case 'loading':
      return null;
    case 'web':
      return <ExternalManageLink href={manage.url}>{t('manageSubscription')}</ExternalManageLink>;
    case 'web_portal':
      return <ManageWebSubscription className="mvg-link gv-linkbtn" />;
    case 'store':
      return manage.store ? (
        <ExternalManageLink href={STORE_SUBSCRIPTIONS_URL[manage.store]}>
          {t(STORE_MANAGE_KEY[manage.store])}
        </ExternalManageLink>
      ) : (
        <span className="gv-quiet">{t('manageInStore')}</span>
      );
  }
}

/**
 * The Account section: plan + account, one quiet row. Pro (or trial) shows the
 * badge and the manage link for its billing source; Free shows the sign-in
 * method and "See what Pro adds". Free copy never mentions limits: logging is
 * free for everyone.
 */
export function AccountSection({ account }: { account: HandoffAccount }) {
  const t = useTranslations('GarageV2');
  const { isPro, isTrialing, trialDaysLeft, isLoading } = useProStatus();
  const mono = (chunks: React.ReactNode) => <span className="gv-mono">{chunks}</span>;

  let row: React.ReactNode;
  if (isLoading) {
    row = <Skeleton height={60} radius={12} />;
  } else if (isPro) {
    row = (
      <div className="gv-account-row gv-account-row--pro">
        <div className="gv-account-plan">
          <span className={isTrialing ? 'gv-badge gv-badge--trial' : 'gv-badge'}>
            {isTrialing ? t('trialBadge') : t('proBadge')}
          </span>
          <span className="gv-account-name">
            {isTrialing ? t('proTrial') : t('proName')}
            {isTrialing && trialDaysLeft != null && (
              <> · {t.rich('trialDaysLeft', { days: trialDaysLeft, n: mono })}</>
            )}
          </span>
          {account.email && <span className="gv-account-email">· {account.email}</span>}
        </div>
        {account.email && <div className="gv-account-email-line">{account.email}</div>}
        <ManageLink />
      </div>
    );
  } else {
    row = (
      <div className="gv-account-row">
        <span className="gv-quiet">
          {account.email ? `${account.email} · ` : ''}
          {t(SIGNED_IN_KEY[account.method])}
        </span>
        <span className="gv-account-free">
          {t('freePlan')} ·
          <Link href="/pro" className="mvg-link">
            {t('seePro')}
          </Link>
        </span>
      </div>
    );
  }

  return (
    <section
      className="gv-account"
      aria-labelledby="gv-account-h"
      aria-busy={isLoading || undefined}
    >
      <h2 id="gv-account-h" className="gv-account-h">
        {t('account')}
      </h2>
      {row}
    </section>
  );
}
