import { palette } from '@motovault/design-system';
import { FollowRiderDocument, UnfollowRiderDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { UserCheck, UserPlus } from 'lucide-react-native';
import { useCallback, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, useColorScheme } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
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
  const isDark = useColorScheme() === 'dark';
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

  return (
    <Animated.View entering={FadeIn.duration(200)}>
      <Pressable
        onPress={handlePress}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={
          isActive
            ? t('community.unfollowLabel', { name: targetUsername })
            : t('community.followLabel', { name: targetUsername })
        }
        style={({ pressed }) => ({
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 6,
          paddingHorizontal: 20,
          paddingVertical: 10,
          borderRadius: 24,
          borderCurve: 'continuous',
          borderWidth: isActive ? 1 : 0,
          borderColor: isActive
            ? isDark
              ? palette.neutral600
              : palette.neutral300
            : 'transparent',
          backgroundColor: isActive
            ? 'transparent'
            : pressed
              ? palette.primary600
              : palette.primary500,
          opacity: pressed ? 0.9 : 1,
          minWidth: 110,
        })}
      >
        {isLoading ? (
          <ActivityIndicator
            size="small"
            color={isActive ? (isDark ? palette.neutral300 : palette.neutral600) : palette.white}
          />
        ) : (
          <>
            <Icon
              size={16}
              color={isActive ? (isDark ? palette.neutral300 : palette.neutral600) : palette.white}
              strokeWidth={2}
            />
            <Text
              style={{
                fontSize: 15,
                fontWeight: '600',
                color: isActive
                  ? isDark
                    ? palette.neutral300
                    : palette.neutral600
                  : palette.white,
              }}
            >
              {isActive ? t('community.followingBtn') : t('community.followBtn')}
            </Text>
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}
