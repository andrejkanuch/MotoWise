'use client';

import { Crown } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useManageSubscription } from '@/hooks/use-manage-subscription';
import { useProStatus } from '@/hooks/use-pro-status';
import { trackEvent, WebEvent } from '@/lib/analytics';
import '@/app/(community)/garage/garage.css';

/**
 * Pro membership banner with self-serve subscription management.
 *
 * Renders only for Pro users. The management affordance adapts to how the user
 * subscribed:
 * - Web Billing → a "Manage subscription" link into RevenueCat's hosted portal
 *   (cancel/update in one click).
 * - App Store / Google Play → static "manage in your app store" copy, since
 *   store subscriptions can't be cancelled from the web.
 * - Still resolving → nothing, to avoid flashing the wrong option.
 *
 * Lives in its own component (not inline in the profile page) so it can also be
 * shown on /profile/edit — a Pro user who hasn't set up a public username is
 * redirected there and would otherwise never reach the cancel link.
 */
export function ProBanner({ className }: { className?: string }) {
  const t = useTranslations('Profile');
  const { isPro, isTrialing, trialDaysLeft } = useProStatus();
  const manage = useManageSubscription();

  if (!isPro) return null;

  return (
    <div className={className ? `prof-banner ${className}` : 'prof-banner'}>
      <div className="prof-banner-left">
        <div className="prof-banner-icon">
          <Crown className="h-5 w-5" />
        </div>
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
        <div className="prof-banner-price">
          {isTrialing ? t('daysLeft', { days: trialDaysLeft ?? '?' }) : t('active')}
        </div>
        {manage.status === 'web' && (
          <a
            href={manage.url}
            target="_blank"
            rel="noopener noreferrer"
            className="prof-banner-manage"
            onClick={() => trackEvent(WebEvent.MANAGE_SUBSCRIPTION_CLICKED)}
          >
            {t('manageSubscription')}
          </a>
        )}
        {manage.status === 'store' && (
          <span className="prof-banner-manage-note">{t('manageInStore')}</span>
        )}
      </div>
    </div>
  );
}
