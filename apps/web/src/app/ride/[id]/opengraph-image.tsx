import { ImageResponse } from 'next/og';
import { fetchRide } from '../../../lib/fetch-ride';
import { formatDistance, formatDuration } from '../../../lib/format-utils';

export const runtime = 'edge';
export const alt = 'MotoVault Ride';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function OGImage({ params }: { params: { id: string } }) {
  const ride = await fetchRide(params.id);

  const title = ride?.name ?? 'MotoVault Ride';
  const distance = ride?.distanceM ? formatDistance(ride.distanceM) : '--';
  const duration = ride?.durationS ? formatDuration(ride.durationS) : '--';
  const hasThumb = !!ride?.routeThumbnailUri;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'row',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Left: route thumbnail or gradient */}
      <div
        style={{
          width: '50%',
          height: '100%',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: hasThumb ? undefined : 'linear-gradient(135deg, #0a1540 0%, #3366e6 100%)',
          overflow: 'hidden',
        }}
      >
        {hasThumb ? (
          // biome-ignore lint/performance/noImgElement: OG image rendering
          <img
            src={ride?.routeThumbnailUri ?? ''}
            alt="Route"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              fontSize: '64px',
              fontWeight: 700,
              color: 'rgba(255,255,255,0.15)',
            }}
          >
            RIDE
          </div>
        )}
      </div>

      {/* Right: info */}
      <div
        style={{
          width: '50%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          padding: '48px',
          background: 'linear-gradient(180deg, #0f2059 0%, #0a1540 100%)',
        }}
      >
        <div style={{ fontSize: '32px', fontWeight: 700, color: 'white', lineHeight: 1.2 }}>
          {title}
        </div>

        {/* Stats */}
        <div style={{ display: 'flex', gap: '32px', marginTop: '32px' }}>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3cb88c' }}>{distance}</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Distance</div>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontSize: '28px', fontWeight: 700, color: '#3cb88c' }}>{duration}</div>
            <div style={{ fontSize: '14px', color: 'rgba(255,255,255,0.5)' }}>Duration</div>
          </div>
        </div>

        {/* Branding */}
        <div
          style={{
            position: 'absolute',
            bottom: '32px',
            right: '48px',
            fontSize: '18px',
            fontWeight: 700,
            color: 'rgba(255,255,255,0.4)',
          }}
        >
          MotoVault
        </div>
      </div>
    </div>,
    { ...size },
  );
}
