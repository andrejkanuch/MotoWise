import { palette } from '@motovault/design-system';
import { UpdateRideDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { ImpactFeedbackStyle } from 'expo-haptics';
import { Share2 } from 'lucide-react-native';
import { useCallback, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Pressable, Share, Text, useColorScheme } from 'react-native';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import { maybeRequestReview } from '../../lib/store-review';
import { triggerImpact } from '../../utils/haptics';

const BASE_URL = process.env.EXPO_PUBLIC_WEB_URL ?? 'https://motovault.app';

interface ShareRideButtonProps {
  rideId: string;
  rideName?: string;
  isPublic: boolean;
  /** Compact icon-only variant */
  compact?: boolean;
}

/**
 * SEQUENTIAL share flow:
 * 1. If ride not public -> call makePublic mutation (mutateAsync — awaits)
 * 2. Only on success -> generate URL and open Share.share()
 * 3. On error -> Alert, do NOT open share sheet
 * guardRef prevents double-tap
 */
export function ShareRideButton({ rideId, rideName, isPublic, compact }: ShareRideButtonProps) {
  const { t } = useTranslation();
  const isDark = useColorScheme() === 'dark';
  const queryClient = useQueryClient();

  const guardRef = useRef(false);

  const makePublicMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateRideDocument, {
        input: { rideId, isPublic: true },
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.rides.detail(rideId) });
    },
  });

  const handleShare = useCallback(async () => {
    // Guard: prevent double-tap
    if (guardRef.current) return;
    guardRef.current = true;

    triggerImpact(ImpactFeedbackStyle.Medium);

    try {
      // Step 1: Make public if needed (await mutation)
      if (!isPublic) {
        await makePublicMutation.mutateAsync();
      }

      // Step 2: Only on success — generate URL and open share sheet
      const shareUrl = `${BASE_URL}/ride/${rideId}`;
      await Share.share({
        message: rideName
          ? t('community.shareMessage', { name: rideName, url: shareUrl })
          : shareUrl,
        url: shareUrl,
      });
      maybeRequestReview();
    } catch {
      // Step 3: On error — Alert, do NOT open share sheet
      Alert.alert(t('common.error'), t('community.shareFailed'));
    } finally {
      guardRef.current = false;
    }
  }, [isPublic, rideId, rideName, makePublicMutation, t]);

  const isLoading = makePublicMutation.isPending;
  const iconColor = isDark ? palette.neutral300 : palette.neutral600;

  if (compact) {
    return (
      <Pressable
        onPress={handleShare}
        disabled={isLoading}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={t('community.shareRide')}
        style={({ pressed }) => ({
          width: 36,
          height: 36,
          borderRadius: 18,
          borderCurve: 'continuous',
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: pressed
            ? isDark
              ? palette.surfacePressed
              : palette.neutral100
            : isDark
              ? palette.surfaceElevated
              : palette.neutral50,
          opacity: isLoading ? 0.5 : 1,
        })}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={iconColor} />
        ) : (
          <Share2 size={16} color={iconColor} strokeWidth={2} />
        )}
      </Pressable>
    );
  }

  return (
    <Pressable
      onPress={handleShare}
      disabled={isLoading}
      accessibilityRole="button"
      accessibilityLabel={t('community.shareRide')}
      style={({ pressed }) => ({
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 20,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: isDark ? palette.neutral600 : palette.neutral300,
        backgroundColor: pressed
          ? isDark
            ? palette.surfacePressed
            : palette.neutral100
          : 'transparent',
        opacity: isLoading ? 0.5 : 1,
      })}
    >
      {isLoading ? (
        <ActivityIndicator size="small" color={iconColor} />
      ) : (
        <>
          <Share2 size={16} color={iconColor} strokeWidth={2} />
          <Text style={{ fontSize: 14, fontWeight: '600', color: iconColor }}>
            {t('community.shareRide')}
          </Text>
        </>
      )}
    </Pressable>
  );
}
