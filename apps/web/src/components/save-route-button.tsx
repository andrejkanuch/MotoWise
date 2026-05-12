'use client';

import { IsTripSavedDocument, SaveTripDocument, UnsaveTripDocument } from '@motovault/graphql';
import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from '@/components/auth-modal';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

/* ── Anonymous save helpers ──────────────────────────────────── */

const ANON_SAVES_KEY = 'motovault_saved_routes';
const ANON_SIGNUP_THRESHOLD = 3;

function getAnonSaves(): string[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(ANON_SAVES_KEY) ?? '[]');
  } catch {
    return [];
  }
}

function toggleAnonSave(routeId: string): string[] {
  const saves = getAnonSaves();
  const next = saves.includes(routeId) ? saves.filter((id) => id !== routeId) : [...saves, routeId];
  localStorage.setItem(ANON_SAVES_KEY, JSON.stringify(next));
  return next;
}

/* ── Types ───────────────────────────────────────────────────── */

interface SaveRouteButtonProps {
  /** Trip ID (unified trips table). Legacy prop name kept for caller compatibility. */
  routeId: string;
  variant?: 'card' | 'inline';
  className?: string;
}

/**
 * Save/unsave a trip. Uses trip-based GraphQL operations (isTripSaved, saveTrip, unsaveTrip).
 * For anonymous users, saves to localStorage and nudges sign-up after 3 saves.
 * Component name kept as SaveRouteButton for backward compatibility with callers.
 */
export function SaveRouteButton({
  routeId: tripId,
  variant = 'card',
  className = '',
}: SaveRouteButtonProps) {
  const [isLoggedIn, setIsLoggedIn] = useState<boolean | null>(null);
  const [saved, setSaved] = useState(false);
  const [loading, setLoading] = useState(false);
  const [showAuth, setShowAuth] = useState(false);
  const [showSignupNudge, setShowSignupNudge] = useState(false);

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const hasSession = !!data.session;
      setIsLoggedIn(hasSession);
      if (hasSession) {
        gqlFetcher(IsTripSavedDocument, { tripId })
          .then((res) => setSaved(res.isTripSaved))
          .catch(() => {});
      } else {
        // Check anonymous localStorage saves
        const anonSaves = getAnonSaves();
        setSaved(anonSaves.includes(tripId));
      }
    });
  }, [tripId]);

  // Auto-dismiss signup nudge
  useEffect(() => {
    if (!showSignupNudge) return;
    const timer = setTimeout(() => setShowSignupNudge(false), 5000);
    return () => clearTimeout(timer);
  }, [showSignupNudge]);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      // Anonymous save flow
      if (isLoggedIn === false) {
        const updatedSaves = toggleAnonSave(tripId);
        const nowSaved = updatedSaves.includes(tripId);
        setSaved(nowSaved);

        if (nowSaved) {
          trackEvent(WebEvent.ROUTE_SAVED_WEB, { trip_id: tripId, anonymous: true });
        }

        // Show sign-up nudge after threshold saves
        if (nowSaved && updatedSaves.length >= ANON_SIGNUP_THRESHOLD) {
          setShowSignupNudge(true);
        }
        return;
      }

      if (isLoggedIn === null) return; // Still loading auth state

      if (loading) return;
      setLoading(true);

      try {
        if (saved) {
          await gqlFetcher(UnsaveTripDocument, { tripId });
          setSaved(false);
        } else {
          await gqlFetcher(SaveTripDocument, { tripId });
          setSaved(true);
          trackEvent(WebEvent.ROUTE_SAVED_WEB, { trip_id: tripId });
        }
      } catch {
        // Silently fail
      } finally {
        setLoading(false);
      }
    },
    [isLoggedIn, saved, loading, tripId],
  );

  const heartSvg = (
    <svg
      className={variant === 'card' ? 'h-5 w-5' : 'h-4 w-4'}
      fill={saved ? 'currentColor' : 'none'}
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z"
      />
    </svg>
  );

  const signupNudge = showSignupNudge && (
    <div
      style={{
        position: 'absolute',
        top: '100%',
        right: 0,
        marginTop: 8,
        padding: '10px 14px',
        background: 'oklch(0.12 0.01 55 / 0.95)',
        backdropFilter: 'blur(16px)',
        border: '1px solid var(--mv-line)',
        borderRadius: 12,
        boxShadow: '0 20px 40px -10px oklch(0 0 0 / 0.6)',
        zIndex: 50,
        minWidth: 220,
        animation: 'fadeIn 0.3s ease',
      }}
    >
      <div
        style={{
          fontSize: 13,
          fontWeight: 500,
          color: 'var(--mv-ink)',
          lineHeight: 1.4,
          marginBottom: 8,
        }}
      >
        Sign up to keep your saves
      </div>
      <div
        style={{
          fontSize: 12,
          color: 'var(--mv-ink-3)',
          lineHeight: 1.4,
          marginBottom: 10,
        }}
      >
        Create a free account to sync saved routes across devices.
      </div>
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setShowSignupNudge(false);
          setShowAuth(true);
        }}
        style={{
          padding: '6px 14px',
          borderRadius: 8,
          background: 'var(--mv-warm-500)',
          color: 'var(--mv-bg)',
          border: 'none',
          fontSize: 12,
          fontWeight: 600,
          fontFamily: 'inherit',
          cursor: 'pointer',
          transition: 'background 0.2s',
        }}
      >
        Sign up free
      </button>
    </div>
  );

  if (variant === 'inline') {
    return (
      <span style={{ position: 'relative', display: 'inline-flex' }}>
        <button
          type="button"
          onClick={handleToggle}
          disabled={loading}
          className={`inline-flex items-center gap-1.5 text-sm transition-colors ${
            saved ? 'text-red-400' : 'text-neutral-500 hover:text-neutral-300'
          } ${className}`}
          aria-label={saved ? 'Remove from saved' : 'Save trip'}
        >
          {heartSvg}
          {saved ? 'Saved' : 'Save'}
        </button>
        {signupNudge}
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} action="save this trip" />
      </span>
    );
  }

  return (
    <span style={{ position: 'relative' }}>
      <button
        type="button"
        onClick={handleToggle}
        disabled={loading}
        className={`flex h-9 w-9 items-center justify-center rounded-full bg-neutral-950/60 backdrop-blur-sm transition-colors ${
          saved ? 'text-red-400' : 'text-neutral-300 hover:text-white'
        } ${className}`}
        aria-label={saved ? 'Remove from saved' : 'Save trip'}
      >
        {heartSvg}
      </button>
      {signupNudge}
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} action="save this trip" />
    </span>
  );
}
