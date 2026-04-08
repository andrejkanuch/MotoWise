import { palette } from '@motovault/design-system';
import { GetRouteReviewsDocument, type GetRouteReviewsQuery } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { Star } from 'lucide-react-native';
import { memo } from 'react';
import { ActivityIndicator, Image, Text, useColorScheme, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';

interface ReviewListProps {
  routeId: string;
}

export const ReviewList = memo(function ReviewList({ routeId }: ReviewListProps) {
  const isDark = useColorScheme() === 'dark';

  const { data, isLoading } = useQuery({
    queryKey: [...queryKeys.routes.detail(routeId), 'reviews'],
    queryFn: () => gqlFetcher(GetRouteReviewsDocument, { routeId, first: 10 }),
  });

  const reviews = data?.getRouteReviews?.reviews ?? [];
  const totalCount = data?.getRouteReviews?.totalCount ?? 0;

  const textColor = isDark ? palette.neutral200 : palette.neutral800;
  const nameColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral500 : palette.neutral400;
  const tagBg = isDark ? palette.neutral800 : palette.neutral200;
  const avatarBg = isDark ? palette.primary700 : palette.primary200;
  const avatarText = isDark ? palette.primary200 : palette.primary700;

  if (isLoading) {
    return (
      <ActivityIndicator size="small" color={palette.accent500} style={{ paddingVertical: 16 }} />
    );
  }

  if (reviews.length === 0) return null;

  return (
    <View style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: 14,
          fontWeight: '700',
          color: isDark ? palette.neutral300 : palette.neutral600,
        }}
      >
        Reviews ({totalCount})
      </Text>

      {reviews.map((review, index) => (
        <Animated.View
          key={review.id}
          entering={FadeInUp.delay(index * 30).duration(200)}
          style={{ gap: 6 }}
        >
          {/* Author row */}
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {review.author.avatarUrl ? (
              <Image
                source={{ uri: review.author.avatarUrl }}
                style={{ width: 28, height: 28, borderRadius: 14 }}
              />
            ) : (
              <View
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 14,
                  backgroundColor: avatarBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Text style={{ fontSize: 12, fontWeight: '700', color: avatarText }}>
                  {review.author.displayName?.charAt(0)?.toUpperCase() ?? '?'}
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: nameColor }}>
                {review.author.displayName}
              </Text>
              {review.bike && (
                <Text style={{ fontSize: 11, color: subtitleColor }}>
                  {review.bike.make} {review.bike.model} {review.bike.year}
                </Text>
              )}
            </View>
            {/* Stars */}
            <View style={{ flexDirection: 'row', gap: 2 }}>
              {[1, 2, 3, 4, 5].map((n) => (
                <Star
                  key={n}
                  size={14}
                  color={palette.warning500}
                  fill={n <= review.rating ? palette.warning500 : 'transparent'}
                />
              ))}
            </View>
          </View>

          {/* Review text */}
          {review.text && (
            <Text style={{ fontSize: 14, lineHeight: 20, color: textColor }}>{review.text}</Text>
          )}

          {/* Condition tags */}
          {review.conditionTags.length > 0 && (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {review.conditionTags.map((tag) => (
                <View
                  key={tag}
                  style={{
                    paddingHorizontal: 8,
                    paddingVertical: 3,
                    borderRadius: 8,
                    backgroundColor: tagBg,
                  }}
                >
                  <Text style={{ fontSize: 11, color: textColor }}>{tag}</Text>
                </View>
              ))}
            </View>
          )}

          {/* Date */}
          <Text style={{ fontSize: 11, color: subtitleColor }}>
            {new Date(review.createdAt).toLocaleDateString(undefined, {
              month: 'short',
              day: 'numeric',
              year: 'numeric',
            })}
          </Text>
        </Animated.View>
      ))}
    </View>
  );
});
