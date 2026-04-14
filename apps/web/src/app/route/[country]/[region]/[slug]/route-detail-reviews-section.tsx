'use client';

import { palette } from '@motovault/design-system';
import type { RouteReview } from '@motovault/types';
import { useRouter } from 'next/navigation';
import { ReviewSoftWall } from '@/components/review-soft-wall';

interface RouteDetailReviewsSectionProps {
  reviews: RouteReview[];
  totalCount: number;
  hasMore: boolean;
  isAuthenticated: boolean;
  ratingAvg: number | null;
}

export function RouteDetailReviewsSection({
  reviews,
  totalCount,
  hasMore,
  isAuthenticated,
  ratingAvg,
}: RouteDetailReviewsSectionProps) {
  const router = useRouter();

  if (reviews.length === 0 && totalCount === 0) return null;

  const showSoftWall = hasMore && !isAuthenticated;

  const handleSignUp = () => {
    const redirect = typeof window !== 'undefined' ? window.location.pathname : '';
    router.push(`/signup?source=review_softwall&redirect=${encodeURIComponent(redirect)}`);
  };

  return (
    <section>
      <div className="mb-6 flex items-center justify-between">
        <h2 className="text-lg font-semibold text-neutral-100">
          Reviews
          {totalCount > 0 && (
            <span className="ml-2 text-sm font-normal text-neutral-500">({totalCount})</span>
          )}
        </h2>
        {ratingAvg != null && (
          <div className="flex items-center gap-1.5">
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={palette.warning500}
              aria-hidden="true"
            >
              <title>Average rating</title>
              <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
            </svg>
            <span className="text-sm font-medium text-neutral-300">{ratingAvg.toFixed(1)}</span>
          </div>
        )}
      </div>

      {/* Visible reviews */}
      <div className="flex flex-col gap-4">
        {reviews.map((review) => (
          <ReviewCard key={review.id} review={review} />
        ))}
      </div>

      {/* Soft wall for anonymous users */}
      {showSoftWall && (
        <div className="relative">
          <div className="select-none" aria-hidden="true" style={{ filter: 'blur(8px)' }}>
            {[1, 2].map((i) => (
              <div
                key={`skeleton-${i}`}
                className="mt-4 rounded-xl border p-5"
                style={{
                  borderColor: palette.neutral800,
                  backgroundColor: palette.neutral900,
                }}
              >
                <div className="mb-3 flex items-center gap-3">
                  <div
                    className="h-8 w-8 rounded-full"
                    style={{ backgroundColor: palette.neutral700 }}
                  />
                  <div className="flex-1">
                    <div
                      className="h-3 w-24 rounded"
                      style={{ backgroundColor: palette.neutral700 }}
                    />
                    <div
                      className="mt-1 h-2 w-16 rounded"
                      style={{ backgroundColor: palette.neutral800 }}
                    />
                  </div>
                </div>
                <div
                  className="mb-2 h-3 w-full rounded"
                  style={{ backgroundColor: palette.neutral800 }}
                />
                <div
                  className="h-3 w-3/4 rounded"
                  style={{ backgroundColor: palette.neutral800 }}
                />
              </div>
            ))}
          </div>
          <div className="absolute inset-0 z-10">
            <ReviewSoftWall
              reviewCountTotal={totalCount}
              hasMore={hasMore}
              onSignUp={handleSignUp}
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review }: { review: RouteReview }) {
  return (
    <div
      className="rounded-xl border p-5"
      style={{
        borderColor: palette.neutral800,
        backgroundColor: palette.neutral900,
      }}
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-3">
          {review.author.avatarUrl ? (
            // biome-ignore lint/performance/noImgElement: avatar from Supabase storage
            <img
              src={review.author.avatarUrl}
              alt=""
              className="h-8 w-8 rounded-full object-cover"
            />
          ) : (
            <div
              className="flex h-8 w-8 items-center justify-center rounded-full text-xs font-semibold"
              style={{
                backgroundColor: palette.primary800,
                color: palette.primary200,
              }}
            >
              {review.author.displayName.charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-sm font-medium" style={{ color: palette.neutral200 }}>
              {review.author.displayName}
            </p>
            {review.bike && (
              <p className="text-xs" style={{ color: palette.neutral500 }}>
                {review.bike.year} {review.bike.make} {review.bike.model}
              </p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-0.5">
          {Array.from({ length: 5 }).map((_, i) => (
            <svg
              // biome-ignore lint/suspicious/noArrayIndexKey: static star list
              key={i}
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill={i < review.rating ? palette.signature400 : palette.neutral700}
              aria-hidden="true"
            >
              <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
            </svg>
          ))}
        </div>
      </div>

      {review.text && (
        <p className="text-sm leading-relaxed" style={{ color: palette.neutral300 }}>
          {review.text}
        </p>
      )}

      {review.conditionTags.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {review.conditionTags.map((tag) => (
            <span
              key={tag}
              className="rounded-full px-2.5 py-0.5 text-xs font-medium"
              style={{
                backgroundColor: `${palette.primary500}20`,
                color: palette.primary300,
              }}
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      <p className="mt-3 text-xs" style={{ color: palette.neutral600 }}>
        {new Date(review.createdAt).toLocaleDateString('en-US', {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        })}
      </p>
    </div>
  );
}
