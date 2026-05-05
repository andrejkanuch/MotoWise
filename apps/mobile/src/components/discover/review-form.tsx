import { palette } from '@motovault/design-system';
import { CreateTripReviewDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Star } from 'lucide-react-native';
import { memo, useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, TextInput, useColorScheme, View } from 'react-native';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';

const CONDITION_TAGS = [
  'Good Surface',
  'Gravel Hazard',
  'Construction',
  'Low Traffic',
  'Heavy Traffic',
  'Scenic',
  'Technical Curves',
] as const;

interface ReviewFormProps {
  /** @deprecated Use tripId instead */
  routeId?: string;
  tripId?: string;
  onSuccess?: () => void;
}

export const ReviewForm = memo(function ReviewForm({
  routeId,
  tripId: tripIdProp,
  onSuccess,
}: ReviewFormProps) {
  const tripId = tripIdProp ?? routeId ?? '';
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(0);
  const [text, setText] = useState('');
  const [selectedTags, setSelectedTags] = useState<string[]>([]);

  const textColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;
  const inputBg = isDark ? palette.surfaceSubtle : palette.neutral100;
  const chipBg = isDark ? palette.neutral800 : palette.neutral200;
  const chipActiveBg = isDark ? palette.accent500 : palette.accent400;

  const mutation = useMutation({
    mutationFn: () =>
      gqlFetcher(CreateTripReviewDocument, {
        input: {
          tripId,
          rating,
          text: text.trim() || undefined,
          conditionTags: selectedTags.length > 0 ? selectedTags : undefined,
        },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
      onSuccess?.();
    },
  });

  const toggleTag = useCallback((tag: string) => {
    setSelectedTags((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag],
    );
  }, []);

  return (
    <View style={{ gap: 16, paddingVertical: 12 }}>
      <Text style={{ fontSize: 16, fontWeight: '700', color: textColor }}>Leave a Review</Text>

      {/* Star rating */}
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Pressable
            key={n}
            onPress={() => {
              setRating(n);
              if (process.env.EXPO_OS === 'ios')
                Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
            hitSlop={4}
          >
            <Star
              size={32}
              color={
                n <= rating ? palette.warning500 : isDark ? palette.neutral600 : palette.neutral300
              }
              fill={n <= rating ? palette.warning500 : 'transparent'}
            />
          </Pressable>
        ))}
      </View>

      {/* Text review */}
      <TextInput
        value={text}
        onChangeText={setText}
        placeholder={t('discoverSearch.reviewPlaceholder')}
        placeholderTextColor={subtitleColor}
        multiline
        maxLength={500}
        style={{
          fontSize: 14,
          lineHeight: 20,
          color: textColor,
          backgroundColor: inputBg,
          borderRadius: 12,
          borderCurve: 'continuous',
          padding: 12,
          minHeight: 80,
          textAlignVertical: 'top',
        }}
      />

      {/* Condition tags */}
      <View>
        <Text style={{ fontSize: 13, fontWeight: '600', color: subtitleColor, marginBottom: 8 }}>
          Road conditions (optional)
        </Text>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {CONDITION_TAGS.map((tag) => {
            const active = selectedTags.includes(tag);
            return (
              <Pressable
                key={tag}
                onPress={() => toggleTag(tag)}
                style={{
                  paddingHorizontal: 12,
                  paddingVertical: 6,
                  borderRadius: 16,
                  borderCurve: 'continuous',
                  backgroundColor: active ? chipActiveBg : chipBg,
                }}
              >
                <Text
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: active ? palette.white : textColor,
                  }}
                >
                  {tag}
                </Text>
              </Pressable>
            );
          })}
        </View>
      </View>

      {/* Submit */}
      <Pressable
        onPress={() => mutation.mutate()}
        disabled={rating === 0 || mutation.isPending}
        style={{
          backgroundColor:
            rating > 0 ? palette.accent500 : isDark ? palette.neutral700 : palette.neutral300,
          paddingVertical: 14,
          borderRadius: 12,
          borderCurve: 'continuous',
          alignItems: 'center',
        }}
      >
        {mutation.isPending ? (
          <ActivityIndicator size="small" color={palette.white} />
        ) : (
          <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
            Submit Review
          </Text>
        )}
      </Pressable>

      {mutation.isError && (
        <Text style={{ fontSize: 13, color: palette.danger500, textAlign: 'center' }}>
          {(mutation.error as Error)?.message?.includes('already reviewed')
            ? 'You have already reviewed this route'
            : 'Failed to submit review. Please try again.'}
        </Text>
      )}
    </View>
  );
});
