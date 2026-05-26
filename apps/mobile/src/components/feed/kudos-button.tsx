import { palette } from '@motovault/design-system';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Heart } from 'lucide-react-native';
import { memo, useCallback, useRef } from 'react';
import { Pressable, Text, useColorScheme, View } from 'react-native';
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';

interface KudosButtonProps {
  rideId: string;
  kudosCount: number;
  hasKudos: boolean;
  onCountPress?: () => void;
}

const COOLDOWN_MS = 300;

export const KudosButton = memo(function KudosButton({
  rideId,
  kudosCount,
  hasKudos,
  onCountPress,
}: KudosButtonProps) {
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();
  const guardRef = useRef(false);
  const lastTapRef = useRef(0);
  const scale = useSharedValue(1);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const { mutate } = useMutation({
    mutationFn: async () => {
      // Lazy import to avoid circular dependency — the document may not exist yet
      const { ToggleKudosDocument } = await import('@motovault/graphql');
      return gqlFetcher(ToggleKudosDocument, { rideId });
    },
    onMutate: async () => {
      // Cancel any outgoing refetches so they don't overwrite optimistic update
      await queryClient.cancelQueries({ queryKey: queryKeys.feed.all });

      // Snapshot previous feed data for rollback
      const previousFeed = queryClient.getQueryData(queryKeys.feed.all);

      // Optimistic update: toggle locally
      queryClient.setQueriesData({ queryKey: queryKeys.feed.all }, (old: unknown) => {
        if (!old) return old;
        // Walk through pages/edges and update the matching ride
        return updateKudosInCache(old, rideId, !hasKudos);
      });

      return { previousFeed };
    },
    onError: (_err, _vars, context) => {
      // Rollback on error
      if (context?.previousFeed) {
        queryClient.setQueryData(queryKeys.feed.all, context.previousFeed);
      }
    },
    onSettled: () => {
      guardRef.current = false;
      queryClient.invalidateQueries({ queryKey: queryKeys.feed.all });
    },
  });

  const handlePress = useCallback(() => {
    const now = Date.now();
    if (guardRef.current || now - lastTapRef.current < COOLDOWN_MS) return;

    guardRef.current = true;
    lastTapRef.current = now;

    // Scale animation: 0.85 -> 1.0 over 80ms
    scale.value = withSequence(
      withTiming(0.85, { duration: 40 }),
      withTiming(1.0, { duration: 40 }),
    );

    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    }

    mutate();
  }, [mutate, scale]);

  const heartColor = hasKudos
    ? palette.danger500
    : isDark
      ? palette.neutral500
      : palette.neutral400;
  const countColor = isDark ? palette.neutral400 : palette.neutral500;

  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
      <Animated.View style={animatedStyle}>
        <Pressable
          onPress={handlePress}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={hasKudos ? 'Remove kudos' : 'Give kudos'}
        >
          <Heart size={20} color={heartColor} fill={hasKudos ? palette.danger500 : 'transparent'} />
        </Pressable>
      </Animated.View>
      {kudosCount > 0 && (
        <Pressable onPress={onCountPress} hitSlop={8}>
          <Text
            style={{
              fontSize: 13,
              fontWeight: '600',
              color: countColor,
              fontVariant: ['tabular-nums'],
            }}
          >
            {kudosCount}
          </Text>
        </Pressable>
      )}
    </View>
  );
});

/**
 * Walk an infinite-query-shaped cache and toggle kudos for a specific ride.
 */
function updateKudosInCache(data: unknown, rideId: string, newHasKudos: boolean): unknown {
  if (!data || typeof data !== 'object') return data;

  const obj = data as Record<string, unknown>;

  // TanStack infinite query shape: { pages: [...], pageParams: [...] }
  if (Array.isArray(obj.pages)) {
    return {
      ...obj,
      pages: obj.pages.map((page: unknown) => updateKudosInCache(page, rideId, newHasKudos)),
    };
  }

  // GraphQL connection shape: { feed: { edges: [...] } }
  if (obj.feed && typeof obj.feed === 'object') {
    const feed = obj.feed as Record<string, unknown>;
    if (Array.isArray(feed.edges)) {
      return {
        ...obj,
        feed: {
          ...feed,
          edges: feed.edges.map((edge: Record<string, unknown>) => {
            const node = edge.node as Record<string, unknown> | undefined;
            if (node?.id === rideId) {
              const prevCount = (node.kudosCount as number) ?? 0;
              return {
                ...edge,
                node: {
                  ...node,
                  hasKudos: newHasKudos,
                  kudosCount: newHasKudos ? prevCount + 1 : Math.max(0, prevCount - 1),
                },
              };
            }
            return edge;
          }),
        },
      };
    }
  }

  return data;
}
