'use client';

import type { TripTemplateNode } from '@/lib/fetch-places';
import { Difficulty, Icon, Stars } from './primitives';
import {
  difficultyKind,
  formatDistance,
  formatNumber,
  formatDuration as formatTime,
  surfaceLabel,
  tripHref,
} from './utils';

export function TripListCard({
  trip,
  idx,
  hovered,
  focused,
  onMouseEnter,
  onMouseLeave,
}: {
  trip: TripTemplateNode;
  idx: number;
  hovered?: boolean;
  focused?: boolean;
  onMouseEnter?: () => void;
  onMouseLeave?: () => void;
}) {
  const surfaceTint = hovered || focused ? 'oklch(0.18 0.014 55)' : 'var(--mv-surface)';
  const href = tripHref(trip);

  return (
    <a
      href={href}
      data-trip-id={trip.id}
      onMouseEnter={onMouseEnter}
      onMouseLeave={onMouseLeave}
      style={{
        display: 'block',
        textDecoration: 'none',
        color: 'inherit',
        background: surfaceTint,
        border: `1px solid ${focused ? 'oklch(0.84 0.15 68 / 0.5)' : 'var(--mv-line)'}`,
        borderRadius: 14,
        overflow: 'hidden',
        transition: 'background .2s, border-color .2s, transform .25s',
        transform: hovered ? 'translateY(-2px)' : 'none',
        position: 'relative',
      }}
    >
      {/* Thumb */}
      <div
        style={{
          position: 'relative',
          aspectRatio: '16 / 9',
          background: `linear-gradient(135deg, oklch(0.28 0.06 ${Math.abs((idx * 33) % 360)}), oklch(0.13 0.02 30)), repeating-linear-gradient(45deg, oklch(1 0 0 / 0.025) 0 2px, transparent 2px 9px)`,
        }}
      >
        {trip.isMotovaultPick && (
          <span
            style={{
              position: 'absolute',
              top: 12,
              left: 12,
              padding: '4px 10px',
              borderRadius: 999,
              background: 'oklch(0.1 0.008 55 / 0.7)',
              backdropFilter: 'blur(8px)',
              border: '1px solid var(--mv-line)',
              color: 'var(--mv-ink-2)',
              fontFamily: 'var(--font-geist-mono, monospace)',
              fontSize: 10,
              letterSpacing: '0.12em',
              textTransform: 'uppercase',
            }}
          >
            Editor&apos;s pick
          </span>
        )}
        <span
          style={{
            position: 'absolute',
            top: 10,
            right: 10,
            width: 32,
            height: 32,
            borderRadius: 999,
            background: 'oklch(0.1 0.008 55 / 0.7)',
            backdropFilter: 'blur(8px)',
            border: '1px solid var(--mv-line)',
            color: 'var(--mv-ink-2)',
            display: 'grid',
            placeItems: 'center',
          }}
        >
          <Icon name="bookmark" size={13} />
        </span>
        <span
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            padding: '4px 9px',
            borderRadius: 6,
            background: 'oklch(0.08 0.008 55 / 0.7)',
            backdropFilter: 'blur(6px)',
            border: '1px solid var(--mv-line)',
            color: 'var(--mv-warm-400)',
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            fontWeight: 600,
            letterSpacing: '0.08em',
          }}
        >
          No {String(idx + 1).padStart(2, '0')}
        </span>
      </div>

      <div style={{ padding: '14px 16px 16px' }}>
        <div
          style={{
            fontFamily: 'var(--font-geist-mono, monospace)',
            fontSize: 10,
            color: 'var(--mv-ink-3)',
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            display: 'flex',
            alignItems: 'center',
            gap: 8,
          }}
        >
          <Icon name="pin" size={11} color="var(--mv-warm-400)" />
          {trip.city ?? trip.regionCode ?? ''}
          {trip.countryCode ? `, ${trip.countryCode}` : ''}
        </div>
        <div
          style={{
            marginTop: 8,
            fontSize: 16,
            fontWeight: 500,
            letterSpacing: '-0.01em',
            lineHeight: 1.25,
          }}
        >
          {trip.title ?? 'Unnamed Route'}
        </div>
        <div
          style={{
            marginTop: 12,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '8px 14px',
            color: 'var(--mv-ink-2)',
          }}
        >
          {trip.distanceM != null && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                letterSpacing: '0.04em',
              }}
            >
              <Icon name="distance" size={11} color="var(--mv-ink-3)" />
              {formatDistance(trip.distanceM)}
            </span>
          )}
          {trip.elevationGainM != null && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                letterSpacing: '0.04em',
              }}
            >
              <Icon name="elev" size={11} color="var(--mv-ink-3)" />↑{' '}
              {formatNumber(trip.elevationGainM)} m
            </span>
          )}
          {trip.estimatedDurationMinutes != null && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 11,
                display: 'inline-flex',
                alignItems: 'center',
                gap: 5,
                letterSpacing: '0.04em',
              }}
            >
              <Icon name="time" size={11} color="var(--mv-ink-3)" />
              {formatTime(trip.estimatedDurationMinutes)}
            </span>
          )}
        </div>
        <div
          style={{
            marginTop: 12,
            paddingTop: 12,
            borderTop: '1px solid var(--mv-line)',
            display: 'flex',
            alignItems: 'center',
            gap: 12,
          }}
        >
          <Difficulty kind={difficultyKind(trip.difficulty)} />
          {trip.surfaceType && (
            <span
              style={{
                fontFamily: 'var(--font-geist-mono, monospace)',
                fontSize: 10,
                color: 'var(--mv-ink-3)',
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
              }}
            >
              {surfaceLabel(trip.surfaceType)}
            </span>
          )}
          <span style={{ flex: 1 }} />
          {trip.averageRating != null && (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Stars value={trip.averageRating} size={11} />
              <span
                style={{
                  fontFamily: 'var(--font-geist-mono, monospace)',
                  fontSize: 11,
                  color: 'var(--mv-ink-2)',
                  marginLeft: 4,
                }}
              >
                {trip.averageRating.toFixed(1)}
              </span>
              {trip.reviewCount > 0 && (
                <span
                  style={{
                    fontFamily: 'var(--font-geist-mono, monospace)',
                    fontSize: 10,
                    color: 'var(--mv-ink-4)',
                  }}
                >
                  ({trip.reviewCount})
                </span>
              )}
            </span>
          )}
        </div>
      </div>
    </a>
  );
}
