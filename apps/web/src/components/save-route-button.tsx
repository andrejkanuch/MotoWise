'use client';

import { IsTripSavedDocument, SaveTripDocument, UnsaveTripDocument } from '@motovault/graphql';
import { useCallback, useEffect, useState } from 'react';
import { AuthModal } from '@/components/auth-modal';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

interface SaveRouteButtonProps {
  /** Trip ID (unified trips table). Legacy prop name kept for caller compatibility. */
  routeId: string;
  variant?: 'card' | 'inline';
  className?: string;
}

/**
 * Save/unsave a trip. Uses trip-based GraphQL operations (isTripSaved, saveTrip, unsaveTrip).
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

  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data }) => {
      const hasSession = !!data.session;
      setIsLoggedIn(hasSession);
      if (hasSession) {
        gqlFetcher(IsTripSavedDocument, { tripId })
          .then((res) => setSaved(res.isTripSaved))
          .catch(() => {});
      }
    });
  }, [tripId]);

  const handleToggle = useCallback(
    async (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();

      if (!isLoggedIn) {
        setShowAuth(true);
        return;
      }

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

  if (variant === 'inline') {
    return (
      <>
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
        <AuthModal open={showAuth} onClose={() => setShowAuth(false)} action="save this trip" />
      </>
    );
  }

  return (
    <>
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
      <AuthModal open={showAuth} onClose={() => setShowAuth(false)} action="save this trip" />
    </>
  );
}
