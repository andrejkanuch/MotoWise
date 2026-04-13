'use client';

import { palette } from '@motovault/design-system';
import posthog from 'posthog-js';
import { useEffect, useRef } from 'react';

interface ReviewSoftWallProps {
  /** Total number of reviews for the route (includes those behind the wall). */
  reviewCountTotal: number;
  /** Whether there are more reviews beyond the visible ones. */
  hasMore: boolean;
  /** Called when the user clicks the sign-up CTA. */
  onSignUp: () => void;
}

/**
 * Renders a blurred overlay over hidden review content with a sign-up CTA.
 * The blurred content remains in the DOM for SEO (JSON-LD AggregateRating +
 * Review array), but is visually obscured for anonymous users.
 */
export function ReviewSoftWall({ reviewCountTotal, hasMore, onSignUp }: ReviewSoftWallProps) {
  const hasFiredShown = useRef(false);

  useEffect(() => {
    if (hasMore && !hasFiredShown.current) {
      hasFiredShown.current = true;
      posthog.capture('review_softwall.shown', {
        review_count_total: reviewCountTotal,
      });
    }
  }, [hasMore, reviewCountTotal]);

  if (!hasMore) return null;

  const handleCtaClick = () => {
    posthog.capture('review_softwall.cta_clicked', {
      review_count_total: reviewCountTotal,
    });
    onSignUp();
  };

  return (
    <div className="relative mt-4">
      {/* Gradient fade into blur — signals content continues */}
      <div
        className="pointer-events-none absolute inset-x-0 -top-16 h-16 z-10"
        style={{
          background: `linear-gradient(to bottom, transparent, ${palette.neutral950})`,
        }}
      />

      {/* Overlay container */}
      <div className="relative flex flex-col items-center justify-center py-12 px-4">
        {/* Blurred backdrop rectangle (purely decorative — real content is
            blurred via the parent in the route detail page) */}
        <div
          className="absolute inset-0 rounded-2xl"
          style={{ backgroundColor: `${palette.neutral900}80` }}
        />

        {/* CTA card */}
        <div
          className="relative z-20 flex flex-col items-center gap-4 rounded-2xl border px-8 py-8 text-center max-w-sm"
          style={{
            backgroundColor: palette.neutral900,
            borderColor: palette.neutral700,
          }}
        >
          <p className="text-lg font-semibold" style={{ color: palette.white }}>
            See all {reviewCountTotal} reviews
          </p>
          <p className="text-sm" style={{ color: palette.neutral400 }}>
            Sign up to read every review, leave your own rating, and save routes.
          </p>
          <button
            type="button"
            onClick={handleCtaClick}
            className="mt-2 rounded-full px-8 py-3 text-sm font-semibold transition-colors"
            style={{
              backgroundColor: palette.primary500,
              color: palette.white,
            }}
          >
            Sign up free
          </button>
          <p className="text-xs" style={{ color: palette.neutral500 }}>
            Free account &middot; no credit card required
          </p>
        </div>
      </div>
    </div>
  );
}
