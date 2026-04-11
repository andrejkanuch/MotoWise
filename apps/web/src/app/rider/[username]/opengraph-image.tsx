import { ImageResponse } from 'next/og';
import { fetchProfile } from '../../../lib/fetch-profile';
import { formatDistance } from '../../../lib/format-utils';

export const runtime = 'edge';
export const alt = 'MotoVault Rider Profile';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';
export const revalidate = 3600;

export default async function OGImage({ params }: { params: { username: string } }) {
  const profile = await fetchProfile(params.username);

  const displayName = profile?.displayName ?? profile?.publicUsername ?? params.username;
  const publicUsername = profile?.publicUsername ?? params.username;
  const totalRides = profile?.rideStats.totalRides ?? 0;
  const totalDistance = profile?.rideStats.totalDistance ?? 0;
  const city = profile?.city;

  return new ImageResponse(
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        padding: '60px',
        background: 'linear-gradient(135deg, #0a1540 0%, #1f40a0 50%, #3366e6 100%)',
        fontFamily: 'sans-serif',
      }}
    >
      {/* Avatar placeholder */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '100px',
          height: '100px',
          borderRadius: '50px',
          backgroundColor: 'rgba(255,255,255,0.15)',
          fontSize: '42px',
          fontWeight: 700,
          color: 'white',
          marginBottom: '24px',
        }}
      >
        {displayName.charAt(0).toUpperCase()}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
        <div style={{ fontSize: '48px', fontWeight: 700, color: 'white' }}>{displayName}</div>
        <div style={{ fontSize: '24px', color: 'rgba(255,255,255,0.6)' }}>
          @{publicUsername}
          {city ? ` · ${city}` : ''}
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: 'flex', gap: '40px', marginTop: '40px' }}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'white' }}>{totalRides}</div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>Rides</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div style={{ fontSize: '36px', fontWeight: 700, color: 'white' }}>
            {formatDistance(totalDistance)}
          </div>
          <div style={{ fontSize: '16px', color: 'rgba(255,255,255,0.5)' }}>Distance</div>
        </div>
      </div>

      {/* Branding */}
      <div
        style={{
          position: 'absolute',
          bottom: '40px',
          right: '60px',
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
        }}
      >
        <div style={{ fontSize: '20px', fontWeight: 700, color: 'rgba(255,255,255,0.5)' }}>
          MotoVault
        </div>
      </div>
    </div>,
    { ...size },
  );
}
