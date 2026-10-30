'use client';

import { Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useManageSubscription } from '@/hooks/use-manage-subscription';
import { useProStatus } from '@/hooks/use-pro-status';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { AppStoreKind, STORE_SUBSCRIPTIONS_URL } from '@/lib/manage-subscription';
import '@/app/(root)/(community)/garage/garage.css';
import { ManageWebSubscription } from './manage-web-subscription';

const STORE_MANAGE_KEY = {
  [AppStoreKind.AppStore]: 'manageAppStore',
  [AppStoreKind.PlayStore]: 'manageGooglePlay',
} as const;

/** A quiet copper link that opens in a new tab and says so to screen readers. */
function ManageExternalLink({ href, children }: { href: string; children: string }) {
  const t = useTranslations('Profile');
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="mv-link is-quiet is-tall"
      onClick={() => trackEvent(WebEvent.MANAGE_SUBSCRIPTION_CLICKED)}
    >
      {children}
      <span className="mvg-sr-only">{t('newTab')}</span>
    </a>
  );
}

/**
 * The Pro row: a hairline row naming the plan and its state in ink, with the
 * one copper action at the end, the self-serve subscription management.
 *
 * Renders only for Pro users. The management affordance adapts to how the user
 * subscribed:
 * - Web Billing → a "Manage subscription" link into RevenueCat's hosted portal
 *   (cancel/update in one click).
 * - Stripe without a management URL → "Manage or cancel", which opens a Stripe
 *   Customer Portal session from the API, with a support fallback.
 * - App Store / Google Play → a link to that store's subscriptions page
 *   (store subscriptions can't be cancelled from the web); a generic note when
 *   the store is unknown.
 * - Still resolving → nothing, to avoid flashing the wrong option.
 *
 * Lives in its own component (not inline in the profile head) so it renders in
 * both /profile states, including the one for a Pro user who hasn't set up a
 * public username, who would otherwise never reach the cancel link.
 */
export function ProBanner({ className }: { className?: string }) {
  const t = useTranslations('Profile');
  const { isPro, isTrialing, trialDaysLeft } = useProStatus();
  const manage = useManageSubscription();

  if (!isPro) return null;

  return (
    <div className={className ? `prof-banner ${className}` : 'prof-banner'}>
      <div className="prof-banner-left">
        <Crown size={18} strokeWidth={1.75} aria-hidden="true" />
        <div>
          <div className="prof-banner-title">{t('proBannerTitle')}</div>
          <div className="prof-banner-meta">
            {isTrialing ? (
              <>
                <span>{t('trial')}</span>
                {trialDaysLeft != null && (
                  <>
                    <span className="dot" />
                    <span>{t('daysRemaining', { days: trialDaysLeft })}</span>
                  </>
                )}
              </>
            ) : (
              <span>{t('active')}</span>
            )}
          </div>
        </div>
      </div>
      <div className="prof-banner-right">
        {manage.status === 'web' && (
          <ManageExternalLink href={manage.url}>{t('manageSubscription')}</ManageExternalLink>
        )}
        {manage.status === 'web_portal' && <ManageWebSubscription />}
        {manage.status === 'store' &&
          (manage.store ? (
            <ManageExternalLink href={STORE_SUBSCRIPTIONS_URL[manage.store]}>
              {t(STORE_MANAGE_KEY[manage.store])}
            </ManageExternalLink>
          ) : (
            <span className="prof-banner-manage-note">{t('manageInStore')}</span>
          ))}
      </div>
    </div>
  );
}
