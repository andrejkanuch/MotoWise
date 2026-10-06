'use client';

import { BillingPortalStatus, CreateBillingPortalSessionDocument } from '@motovault/graphql';
import * as Sentry from '@sentry/nextjs';
import { useTranslations } from 'next-intl';
import { useState } from 'react';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { isSafePortalUrl, SUPPORT_EMAIL } from '@/lib/manage-subscription';

const PHASE = {
  IDLE: 'idle',
  OPENING: 'opening',
  FALLBACK: 'fallback',
} as const;

type Phase = (typeof PHASE)[keyof typeof PHASE];

/**
 * "Manage or cancel" for a web (Stripe) subscriber whose RevenueCat
 * `managementURL` is null. Asks the API for a one-time Stripe Customer Portal
 * session and sends the rider there. If the API can't (feature not configured,
 * Stripe error), shows how to cancel anyway: the link in the Stripe receipt
 * email, or support — a subscriber must never be left without a cancel path.
 *
 * `className` restyles the button (the garage account row renders it as a
 * copper text link); the default is the /profile banner's button.
 */
export function ManageWebSubscription({
  className = 'prof-banner-manage',
}: {
  className?: string;
} = {}) {
  const t = useTranslations('Profile');
  const [phase, setPhase] = useState<Phase>(PHASE.IDLE);

  const open = async () => {
    if (phase === PHASE.OPENING) return;
    setPhase(PHASE.OPENING);
    trackEvent(WebEvent.MANAGE_SUBSCRIPTION_CLICKED);
    try {
      const { createBillingPortalSession: session } = await gqlFetcher(
        CreateBillingPortalSessionDocument,
      );
      if (session.status === BillingPortalStatus.Ok && isSafePortalUrl(session.url)) {
        window.location.assign(session.url);
        return;
      }
      Sentry.captureMessage('Billing portal unavailable for web subscriber', {
        level: 'warning',
        tags: { area: 'subscription', op: 'createBillingPortalSession' },
        extra: { status: session.status },
      });
    } catch (err) {
      Sentry.captureException(err, {
        tags: { area: 'subscription', op: 'createBillingPortalSession' },
      });
    }
    setPhase(PHASE.FALLBACK);
  };

  return (
    <>
      <button type="button" className={className} onClick={open} disabled={phase === PHASE.OPENING}>
        {phase === PHASE.OPENING ? t('manageOpening') : t('manageOrCancel')}
      </button>
      {phase === PHASE.FALLBACK && (
        <p className="prof-banner-manage-help" role="status">
          {t.rich('manageWebFallback', {
            email: SUPPORT_EMAIL,
            link: (chunks) => <a href={`mailto:${SUPPORT_EMAIL}`}>{chunks}</a>,
          })}
        </p>
      )}
    </>
  );
}
