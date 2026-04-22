import { palette } from '@motovault/design-system';
import { RotateTripShareTokenDocument, UpdateTripDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Check, Copy, Link2, RefreshCw, Share2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  Share,
  Text,
  useColorScheme,
  View,
} from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';

interface TripShareSheetProps {
  tripId: string;
  visible: boolean;
  onClose: () => void;
  tripStatus?: string;
}

function buildShareUrl(token: string): string {
  return `https://motovault.app/t/${token}`;
}

function truncate(url: string): string {
  if (url.length <= 44) return url;
  return `${url.slice(0, 26)}…${url.slice(-12)}`;
}

/**
 * Organiser share sheet for trip capability URLs.
 *
 * The plaintext token is session-scoped state only — it is never persisted.
 * The DB stores only sha256(token); the organiser must rotate the token to
 * obtain a new plaintext value to copy or share.
 */
export function TripShareSheet({ tripId, visible, onClose, tripStatus }: TripShareSheetProps) {
  const isDark = useColorScheme() === 'dark';
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [plaintextToken, setPlaintextToken] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  const bg = isDark ? palette.neutral950 : palette.white;
  const titleColor = isDark ? palette.white : palette.neutral950;
  const bodyColor = isDark ? palette.neutral300 : palette.neutral600;
  const mutedColor = isDark ? palette.neutral500 : palette.neutral400;
  const dividerColor = isDark ? palette.neutral800 : palette.neutral200;
  const chipBg = isDark ? palette.neutral900 : palette.neutral100;

  const rotateMutation = useMutation({
    mutationFn: () => gqlFetcher(RotateTripShareTokenDocument, { tripId }),
    onSuccess: (data) => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setPlaintextToken(data.rotateTripShareToken);
      setJustCopied(false);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.my });
    },
    onError: () => {
      Alert.alert('Could not create link', 'Something went wrong. Please try again in a moment.');
    },
  });

  const updateTripMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateTripDocument, {
        input: { tripId, visibility: 'private' },
      }),
    onSuccess: () => {
      if (process.env.EXPO_OS === 'ios')
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.detail(tripId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.all });
      queryClient.invalidateQueries({ queryKey: queryKeys.trips.discoverRiderStrip });
      setPlaintextToken(null);
      onClose();
    },
    onError: () => {
      Alert.alert('Could not update trip', 'Please try again.');
    },
  });

  const shareUrl = plaintextToken ? buildShareUrl(plaintextToken) : null;

  const handleGenerate = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rotateMutation.mutate();
  }, [rotateMutation]);

  const handleRegenerate = useCallback(() => {
    Alert.alert(
      'Regenerate link?',
      'The previous link will stop working immediately. Anyone using it will need a new link.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Regenerate',
          style: 'destructive',
          onPress: () => rotateMutation.mutate(),
        },
      ],
    );
  }, [rotateMutation]);

  const handleCopy = useCallback(async () => {
    if (!shareUrl) return;
    await Clipboard.setStringAsync(shareUrl);
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setJustCopied(true);
    trackEvent(AnalyticsEvent.TRIP_SHARED, { trip_id: tripId, method: 'copy_link' });
    setTimeout(() => setJustCopied(false), 1600);
  }, [shareUrl, tripId]);

  const handleShareSystem = useCallback(async () => {
    if (!shareUrl) return;
    const result = await Share.share({
      message: 'Trip on MotoVault',
      url: shareUrl,
    });
    // Only fire analytics when the user actually completes the share —
    // dismissing the system sheet should not count as a share event.
    if (result.action === Share.sharedAction) {
      trackEvent(AnalyticsEvent.TRIP_SHARED, { trip_id: tripId, method: 'system_share' });
    }
  }, [shareUrl, tripId]);

  const handleStopSharing = useCallback(() => {
    Alert.alert(
      'Stop sharing this trip?',
      'The link will stop working immediately and the trip becomes private.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Stop sharing',
          style: 'destructive',
          onPress: () => updateTripMutation.mutate(),
        },
      ],
    );
  }, [updateTripMutation]);

  const handleClose = useCallback(() => {
    setPlaintextToken(null);
    setJustCopied(false);
    onClose();
  }, [onClose]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={handleClose}
      statusBarTranslucent
    >
      <View style={{ flex: 1, backgroundColor: bg, paddingTop: insets.top + 8 }}>
        {/* Header */}
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            paddingHorizontal: 20,
            paddingBottom: 16,
            borderBottomWidth: 1,
            borderBottomColor: dividerColor,
          }}
        >
          <Text
            style={{
              fontSize: 18,
              fontWeight: '800',
              color: titleColor,
              letterSpacing: -0.3,
            }}
          >
            Share trip
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            style={{
              width: 34,
              height: 34,
              borderRadius: 17,
              borderCurve: 'continuous',
              backgroundColor: chipBg,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={18} color={titleColor} />
          </Pressable>
        </View>

        <View style={{ flex: 1, paddingHorizontal: 20, paddingTop: 24 }}>
          {tripStatus === 'archived' ? (
            <Animated.View
              entering={FadeIn.duration(220)}
              style={{ alignItems: 'center', paddingTop: 40 }}
            >
              <View
                style={{
                  width: 64,
                  height: 64,
                  borderRadius: 32,
                  borderCurve: 'continuous',
                  backgroundColor: chipBg,
                  alignItems: 'center',
                  justifyContent: 'center',
                  marginBottom: 16,
                }}
              >
                <Link2 size={28} color={mutedColor} />
              </View>
              <Text
                style={{
                  fontSize: 15,
                  fontWeight: '600',
                  color: bodyColor,
                  textAlign: 'center',
                }}
              >
                Unarchive this trip to share it.
              </Text>
            </Animated.View>
          ) : !plaintextToken ? (
            <Animated.View entering={FadeIn.duration(220)}>
              <View
                style={{
                  alignItems: 'center',
                  marginBottom: 24,
                }}
              >
                <View
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 32,
                    borderCurve: 'continuous',
                    backgroundColor: isDark ? palette.accentTint : palette.accentBgLight,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Link2 size={28} color={palette.accent500} />
                </View>
                <Text
                  style={{
                    fontSize: 20,
                    fontWeight: '800',
                    color: titleColor,
                    letterSpacing: -0.4,
                    marginBottom: 8,
                    textAlign: 'center',
                  }}
                >
                  Generate a share link
                </Text>
                <Text
                  style={{
                    fontSize: 14,
                    color: bodyColor,
                    lineHeight: 20,
                    textAlign: 'center',
                  }}
                >
                  Anyone with this link can view and forward the trip.
                </Text>
              </View>

              <Pressable
                onPress={handleGenerate}
                disabled={rotateMutation.isPending}
                style={{
                  backgroundColor: palette.accent500,
                  paddingVertical: 16,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  alignItems: 'center',
                  flexDirection: 'row',
                  justifyContent: 'center',
                  gap: 10,
                  opacity: rotateMutation.isPending ? 0.6 : 1,
                }}
              >
                {rotateMutation.isPending ? (
                  <ActivityIndicator size="small" color={palette.white} />
                ) : (
                  <Link2 size={18} color={palette.white} />
                )}
                <Text
                  style={{
                    color: palette.white,
                    fontSize: 16,
                    fontWeight: '700',
                    letterSpacing: 0.2,
                  }}
                >
                  Generate link
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(260)}>
              {/* URL display */}
              <Text
                style={{
                  fontSize: 11,
                  fontWeight: '700',
                  color: mutedColor,
                  letterSpacing: 0.8,
                  textTransform: 'uppercase',
                  marginBottom: 10,
                }}
              >
                Share URL
              </Text>
              <View
                style={{
                  backgroundColor: chipBg,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  padding: 14,
                  marginBottom: 16,
                  borderWidth: 1,
                  borderColor: dividerColor,
                }}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    fontFamily: process.env.EXPO_OS === 'ios' ? 'Menlo' : 'monospace',
                    color: titleColor,
                  }}
                >
                  {truncate(shareUrl ?? '')}
                </Text>
              </View>

              {/* Info line */}
              <Text
                style={{
                  fontSize: 12,
                  color: isDark ? palette.neutral400 : palette.neutral500,
                  textAlign: 'center',
                  marginBottom: 16,
                }}
              >
                Anyone with this link can view your trip
              </Text>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <Pressable
                  onPress={handleCopy}
                  style={{
                    flex: 1,
                    backgroundColor: palette.accent500,
                    paddingVertical: 14,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  {justCopied ? (
                    <Check size={18} color={palette.white} />
                  ) : (
                    <Copy size={18} color={palette.white} />
                  )}
                  <Text
                    style={{
                      color: palette.white,
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    {justCopied ? 'Copied' : 'Copy link'}
                  </Text>
                </Pressable>
                <Pressable
                  onPress={handleShareSystem}
                  style={{
                    flex: 1,
                    backgroundColor: chipBg,
                    borderWidth: 1,
                    borderColor: dividerColor,
                    paddingVertical: 14,
                    borderRadius: 12,
                    borderCurve: 'continuous',
                    flexDirection: 'row',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: 8,
                  }}
                >
                  <Share2 size={18} color={titleColor} />
                  <Text
                    style={{
                      color: titleColor,
                      fontSize: 15,
                      fontWeight: '700',
                    }}
                  >
                    Share…
                  </Text>
                </Pressable>
              </View>

              <Pressable
                onPress={handleRegenerate}
                disabled={rotateMutation.isPending}
                style={{
                  paddingVertical: 12,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 8,
                  opacity: rotateMutation.isPending ? 0.6 : 1,
                }}
              >
                <RefreshCw size={15} color={palette.danger500} />
                <Text
                  style={{
                    color: palette.danger500,
                    fontSize: 14,
                    fontWeight: '600',
                  }}
                >
                  Regenerate link
                </Text>
              </Pressable>

              {/* Warning */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  padding: 14,
                  marginTop: 20,
                  backgroundColor: isDark ? palette.warningBgDark : palette.warningBgLight,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                }}
              >
                <AlertTriangle size={16} color={palette.warning500} />
                <Text
                  style={{
                    flex: 1,
                    fontSize: 12,
                    lineHeight: 17,
                    color: bodyColor,
                  }}
                >
                  Anyone with this link can view and forward the trip. Rotate the link if it leaks.
                </Text>
              </View>
            </Animated.View>
          )}
        </View>

        {/* Stop sharing — available unless archived */}
        {tripStatus !== 'archived' && (
          <View
            style={{
              paddingHorizontal: 20,
              paddingBottom: insets.bottom + 16,
              paddingTop: 12,
              borderTopWidth: 1,
              borderTopColor: dividerColor,
            }}
          >
            <Pressable
              onPress={handleStopSharing}
              disabled={updateTripMutation.isPending}
              style={{
                paddingVertical: 14,
                borderRadius: 12,
                borderCurve: 'continuous',
                alignItems: 'center',
                opacity: updateTripMutation.isPending ? 0.6 : 1,
              }}
            >
              {updateTripMutation.isPending ? (
                <ActivityIndicator size="small" color={palette.danger500} />
              ) : (
                <Text
                  style={{
                    color: palette.danger500,
                    fontSize: 15,
                    fontWeight: '700',
                  }}
                >
                  Stop sharing
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
