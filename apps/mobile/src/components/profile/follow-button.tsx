import { FollowRiderDocument, UnfollowRiderDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { UserCheck, UserPlus } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { tint, useEditorialTheme } from '../../theme/editorial';
import { radius, space, type } from '../../theme/type';
import { triggerImpact } from '../../utils/haptics';

interface FollowButtonProps {
  targetUserId: string;
  targetUsername: string;
  /** Server-confirmed follow state */
  isFollowing: boolean;
}

/**
 * CRITICAL: Race-condition-safe follow button.
 * - guardRef prevents double-tap with 500ms cooldown
 * - Toggle direction based on serverFollowing (last confirmed), NOT optimistic
 * - Separate serverFollowing vs optimisticFollowing state
 */
export function FollowButton({
  targetUserId,
  targetUsername,
  isFollowing: initialIsFollowing,
}: FollowButtonProps) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  const queryClient = useQueryClient();

  // Server truth — updated only on mutation success/error
  const [serverFollowing, setServerFollowing] = useState(initialIsFollowing);
  // Optimistic — updated immediately on tap for UI feedback
  const [optimisticFollowing, setOptimisticFollowing] = useState(initialIsFollowing);

  // Guard ref for double-tap prevention with 500ms cooldown
  const guardRef = useRef(false);

  const followMutation = useMutation({
    mutationFn: () => gqlFetcher(FollowRiderDocument, { input: { targetUserId } }),
    onSuccess: () => {
      setServerFollowing(true);
      setOptimisticFollowing(true);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.byUsername(targetUsername) });
    },
    onError: () => {
      // Revert optimistic to server truth
      setOptimisticFollowing(serverFollowing);
    },
  });

  const unfollowMutation = useMutation({
    mutationFn: () => gqlFetcher(UnfollowRiderDocument, { input: { targetUserId } }),
    onSuccess: () => {
      setServerFollowing(false);
      setOptimisticFollowing(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.profiles.byUsername(targetUsername) });
    },
    onError: () => {
      // Revert optimistic to server truth
      setOptimisticFollowing(serverFollowing);
    },
  });

  const isLoading = followMutation.isPending || unfollowMutation.isPending;

  const handlePress = useCallback(() => {
    // Guard: prevent rapid double-tap
    if (guardRef.current) return;
    guardRef.current = true;
    setTimeout(() => {
      guardRef.current = false;
    }, 500);

    triggerImpact(ImpactFeedbackStyle.Medium);

    // CRITICAL: base toggle direction on serverFollowing, NOT optimistic
    if (serverFollowing) {
      setOptimisticFollowing(false);
      unfollowMutation.mutate();
    } else {
      setOptimisticFollowing(true);
      followMutation.mutate();
    }
  }, [serverFollowing, followMutation, unfollowMutation]);

  const isActive = optimisticFollowing;
  const Icon = isActive ? UserCheck : UserPlus;
  // Follow is the action (copper); Following is a settled state (graphite).
  const fg = isActive ? theme.ink : theme.onWarm;

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Pressable
        onPress={handlePress}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityState={{ busy: isLoading }}
        accessibilityLabel={
          isActive
            ? t('community.unfollowLabel', { name: targetUsername })
            : t('community.followLabel', { name: targetUsername })
        }
        android_ripple={{ color: tint(theme.ink, 0.12) }}
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: space.xs,
          paddingHorizontal: space.lg,
          minHeight: 44,
          minWidth: 120,
          borderRadius: radius.pill,
          borderCurve: 'continuous',
          overflow: 'hidden',
          backgroundColor: isActive ? theme.surface2 : theme.warm,
          opacity: pressed && process.env.EXPO_OS === 'ios' ? 0.85 : 1,
        })}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={fg} />
        ) : (
          <>
            <Icon size={16} color={fg} strokeWidth={2} />
            <Text style={[type.bodyStrong, { fontSize: 15, color: fg }]}>
              {isActive ? t('community.followingBtn') : t('community.followBtn')}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
