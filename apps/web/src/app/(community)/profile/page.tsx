'use client';

import type { GetRiderProfileQuery, MeQuery } from '@motovault/graphql';
import { GetRiderProfileDocument, MeDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { Crown, MapPin } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useTranslations } from 'next-intl';
import { useEffect } from 'react';
import { useProStatus } from '@/hooks/use-pro-status';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import '@/app/(community)/garage/garage.css';

type User = MeQuery['me'];
type RideStats = GetRiderProfileQuery['getRiderProfile']['rideStats'];

export default function ProfilePage() {
  const t = useTranslations('Profile');
  const router = useRouter();
  const { isPro, isTrialing, trialDaysLeft } = useProStatus();

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

  // If no public profile set up, redirect to edit
  useEffect(() => {
    if (!meLoading && user && !user.publicUsername) {
      router.replace('/profile/edit');
    }
  }, [meLoading, user, router]);

  if (meLoading) {
    return (
      <div
        className="garage-page"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '60vh',
        }}
      >
        <div
          className="h-8 w-8 animate-spin rounded-full border-2"
          style={{ borderColor: 'var(--mv-line)', borderTopColor: 'var(--mv-warm-400)' }}
        />
      </div>
    );
  }

  if (meError) {
    return (
      <div className="garage-page" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ fontSize: '18px', color: 'var(--mv-ink-2)' }}>{t('failedToLoad')}</p>
        <p style={{ fontSize: '14px', color: 'var(--mv-ink-3)', marginTop: '4px' }}>
          {t('somethingWentWrong')}
        </p>
        <button
          type="button"
          className="mv-btn primary"
          style={{ marginTop: '16px' }}
          onClick={() => window.location.reload()}
        >
          {t('retry')}
        </button>
      </div>
    );
  }

  if (!user) return null;

  if (!user.publicUsername) {
    return (
      <div className="garage-page" style={{ textAlign: 'center', paddingTop: '80px' }}>
        <p style={{ fontSize: '18px', color: 'var(--mv-ink-2)' }}>{t('setupProfile')}</p>
        <p
          style={{
            fontSize: '14px',
            color: 'var(--mv-ink-3)',
            marginTop: '4px',
            maxWidth: '320px',
            margin: '4px auto 0',
          }}
        >
          {t('setupDesc')}
        </p>
        <a
          href="/profile/edit"
          className="mv-btn primary"
          style={{ marginTop: '16px', display: 'inline-flex' }}
        >
          {t('createProfile')}
        </a>
      </div>
    );
  }

  const initial = user.displayName?.charAt(0)?.toUpperCase() ?? user.email.charAt(0).toUpperCase();
  const memberSince = new Date(user.createdAt);
  const memberMonth = memberSince.toLocaleDateString('en-US', { month: 'short' });
  const memberYear = `'${memberSince.getFullYear().toString().slice(-2)}`;

  return (
    <div className="garage-page" style={{ paddingTop: '40px', paddingBottom: '60px' }}>
      <div className="garage-inner" style={{ maxWidth: '780px' }}>
        {/* Pro Banner — Pro users only */}
        {isPro && (
          <div className="prof-banner">
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
            </div>
          </div>
        )}

        {/* Profile Card */}
        <div className="prof-card">
          <div
            style={{
              display: 'flex',
              alignItems: 'flex-start',
              justifyContent: 'space-between',
              gap: '24px',
              flexWrap: 'wrap',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
              {user.avatarUrl ? (
                // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
                <img
                  src={user.avatarUrl}
                  alt={user.displayName ?? 'Avatar'}
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    objectFit: 'cover',
                    border: '1px solid var(--mv-line)',
                  }}
                />
              ) : (
                <div
                  style={{
                    width: '72px',
                    height: '72px',
                    borderRadius: '50%',
                    background: 'linear-gradient(135deg, oklch(0.4 0.05 50), oklch(0.22 0.03 50))',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    fontSize: '28px',
                    fontWeight: 500,
                    color: 'var(--mv-ink)',
                    border: '1px solid var(--mv-line)',
                  }}
                >
                  {initial}
                </div>
              )}
              <div>
                <h2
                  style={{
                    fontSize: '26px',
                    fontWeight: 500,
                    letterSpacing: '-0.02em',
                    lineHeight: 1.1,
                    margin: '0 0 5px',
                    color: 'var(--mv-ink)',
                  }}
                >
                  {user.displayName ?? user.fullName ?? t('rider')}
                </h2>
                <div
                  style={{
                    fontSize: '13.5px',
                    color: 'var(--mv-ink-3)',
                    fontFamily: "'Geist Mono', monospace",
                    letterSpacing: '0.02em',
                  }}
                >
                  @{user.publicUsername}
                </div>
                {user.city && (
                  <div
                    style={{
                      fontSize: '12.5px',
                      color: 'var(--mv-ink-3)',
                      marginTop: '6px',
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                    }}
                  >
                    <MapPin className="h-3 w-3" />
                    {user.city}
                  </div>
                )}
              </div>
            </div>
            <a href="/profile/edit" className="mv-btn">
              {t('editProfile')}
            </a>
          </div>

          {user.bio && (
            <p
              style={{
                marginTop: '20px',
                fontSize: '14.5px',
                lineHeight: 1.6,
                color: 'var(--mv-ink-2)',
                maxWidth: '60ch',
                letterSpacing: '-0.005em',
              }}
            >
              {user.bio}
            </p>
          )}

          {/* Stats Row — 5 columns */}
          <div className="prof-stats">
            <div className="prof-stat">
              <div className="prof-stat-num">{user.followerCount ?? 0}</div>
              <div className="prof-stat-lbl">{t('followers')}</div>
            </div>
            <div className="prof-stat">
              <div className="prof-stat-num">{user.followingCount ?? 0}</div>
              <div className="prof-stat-lbl">{t('following')}</div>
            </div>
            <div className="prof-stat">
              <div className="prof-stat-num">{rideStats?.totalRides ?? 0}</div>
              <div className="prof-stat-lbl">{t('totalRides')}</div>
            </div>
            <div className="prof-stat">
              <div className="prof-stat-num">
                {rideStats?.totalDistance
                  ? (rideStats.totalDistance / 1000).toLocaleString('en-US', {
                      maximumFractionDigits: 0,
                    })
                  : '0'}
                <span className="unit">km</span>
              </div>
              <div className="prof-stat-lbl">{t('distance')}</div>
            </div>
            <div className="prof-stat">
              <div className="prof-stat-num">
                <span className="serif">{memberMonth}</span> {memberYear}
              </div>
              <div className="prof-stat-lbl">{t('memberSince')}</div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
