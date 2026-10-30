'use client';

import type { GetRiderProfileQuery, MeQuery } from '@motovault/graphql';
import { GetRiderProfileDocument, MeDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { MapPin } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { DoInAppHint } from '@/components/do-in-app-hint';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { ProBanner } from './pro-banner';
import '@/app/(community)/garage/garage.css';

type User = MeQuery['me'];
type RideStats = GetRiderProfileQuery['getRiderProfile']['rideStats'];

/** One profile stat: a condensed figure over its system-face label. */
function Stat({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prof-stat">
      <dt>{label}</dt>
      <dd className="prof-stat-num mv-figure">{children}</dd>
    </div>
  );
}

export default function ProfilePage() {
  const t = useTranslations('Profile');

  const {
    data: meData,
    isLoading: meLoading,
    isError: meError,
  } = useQuery({
    queryKey: ['me'],
    queryFn: () => gqlFetcher(MeDocument),
  });

  const user: User | undefined = meData?.me;

  const { data: profileData } = useQuery({
    queryKey: ['profile', 'rider', user?.publicUsername],
    queryFn: () => gqlFetcher(GetRiderProfileDocument, { username: user?.publicUsername ?? '' }),
    enabled: !!user?.publicUsername,
  });

  const rideStats: RideStats | undefined = profileData?.getRiderProfile?.rideStats;

  // Track profile view on mount
  useEffect(() => {
    trackEvent(WebEvent.PROFILE_VIEWED);
  }, []);

  if (meLoading) {
    return (
      <div className="garage-page">
        <div className="garage-inner prof-state" aria-busy="true">
          <h1 className="prof-title">{t('title')}</h1>
          <div className="prof-spinner" role="status" aria-label={t('title')} />
        </div>
      </div>
    );
  }

  if (meError) {
    return (
      <div className="garage-page">
        <div className="garage-inner prof-state" role="alert">
          <h1 className="prof-title">{t('failedToLoad')}</h1>
          <p className="prof-quiet">{t('somethingWentWrong')}</p>
          <button
            type="button"
            className="mv-btn mv-btn-ghost"
            onClick={() => window.location.reload()}
          >
            {t('retry')}
          </button>
        </div>
      </div>
    );
  }

  if (!user) return null;

  // Read-only (#277): the public profile is set up and edited in the app. The
  // ProBanner stays so a Pro rider without a public username still reaches the
  // manage/cancel path.
  if (!user.publicUsername) {
    return (
      <div className="garage-page">
        <div className="garage-inner">
          <ProBanner />
          <div className="prof-state" style={{ paddingTop: 0 }}>
            <h1 className="prof-title">{t('setupProfile')}</h1>
            <p className="prof-quiet" style={{ maxWidth: '44ch' }}>
              {t('setupDesc')}
            </p>
            <DoInAppHint />
          </div>
        </div>
      </div>
    );
  }

  const initial = user.displayName?.charAt(0)?.toUpperCase() ?? user.email.charAt(0).toUpperCase();
  const memberSince = new Date(user.createdAt);
  const memberMonth = memberSince.toLocaleDateString('en-US', { timeZone: 'UTC', month: 'short' });
  // getUTCFullYear, not getFullYear: memberMonth above formats in UTC, so a local-time
  // year would disagree with it across a New Year boundary (e.g. "Dec '25" rendered
  // as "Dec '26" for a visitor already in the new year).
  const memberYear = `'${memberSince.getUTCFullYear().toString().slice(-2)}`;
  const distanceKm = rideStats?.totalDistance
    ? (rideStats.totalDistance / 1000).toLocaleString('en-US', { maximumFractionDigits: 0 })
    : '0';

  return (
    <div className="garage-page">
      <div className="garage-inner">
        {/* Pro row — Pro users only (self-serve subscription management) */}
        <ProBanner />

        <header className="prof-head">
          <div className="prof-identity">
            {user.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
              <img
                src={user.avatarUrl}
                alt={user.displayName ?? 'Avatar'}
                className="prof-avatar"
              />
            ) : (
              <div className="prof-avatar prof-avatar--initial" aria-hidden="true">
                {initial}
              </div>
            )}
            <div style={{ minWidth: 0 }}>
              <h1 className="prof-title">{user.displayName ?? user.fullName ?? t('rider')}</h1>
              <div className="prof-handle">@{user.publicUsername}</div>
              {user.city && (
                <div className="prof-city">
                  <MapPin size={14} strokeWidth={1.75} aria-hidden="true" />
                  {user.city}
                </div>
              )}
            </div>
          </div>
          <DoInAppHint />
        </header>

        {user.bio && <p className="prof-bio">{user.bio}</p>}

        {/* Stats: five figures on one hairline, honest numbers only */}
        <dl className="prof-stats">
          <Stat label={t('followers')}>{user.followerCount ?? 0}</Stat>
          <Stat label={t('following')}>{user.followingCount ?? 0}</Stat>
          <Stat label={t('totalRides')}>{rideStats?.totalRides ?? 0}</Stat>
          <Stat label={t('distance')}>
            {distanceKm}
            <span className="unit">km</span>
          </Stat>
          <Stat label={t('memberSince')}>
            {t('memberSinceValue', { month: memberMonth, year: memberYear })}
          </Stat>
        </dl>
      </div>
    </div>
  );
}
