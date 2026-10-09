import { RotateTripShareTokenDocument, UpdateTripDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import { AlertTriangle, Check, Copy, Link2, RefreshCw, Share2, X } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, Share, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { queryKeys } from '../lib/query-keys';
import { maybeRequestReview } from '../lib/store-review';
import { tint, useEditorialTheme } from '../theme/editorial';
import { SYSTEM_WEIGHT, type } from '../theme/type';

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
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();

  const [plaintextToken, setPlaintextToken] = useState<string | null>(null);
  const [justCopied, setJustCopied] = useState(false);

  const bg = theme.surface;
  const titleColor = theme.ink;
  const bodyColor = theme.ink2;
  const mutedColor = theme.ink3;
  const dividerColor = theme.line;
  const chipBg = theme.surface2;

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
      Alert.alert(t('tripShare.createErrorTitle'), t('tripShare.createErrorBody'));
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
      Alert.alert(t('tripShare.updateErrorTitle'), t('tripShare.updateErrorBody'));
    },
  });

  const shareUrl = plaintextToken ? buildShareUrl(plaintextToken) : null;

  const handleGenerate = useCallback(() => {
    if (process.env.EXPO_OS === 'ios') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    rotateMutation.mutate();
  }, [rotateMutation]);

  const handleRegenerate = useCallback(() => {
    Alert.alert(t('tripShare.regenerateConfirmTitle'), t('tripShare.regenerateConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tripShare.regenerateConfirmCta'),
        style: 'destructive',
        onPress: () => rotateMutation.mutate(),
      },
    ]);
  }, [rotateMutation, t]);

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
      message: t('tripShare.shareMessage'),
      url: shareUrl,
    });
    // Only fire analytics when the user actually completes the share —
    // dismissing the system sheet should not count as a share event.
    if (result.action === Share.sharedAction) {
      trackEvent(AnalyticsEvent.TRIP_SHARED, { trip_id: tripId, method: 'system_share' });
      maybeRequestReview();
    }
  }, [shareUrl, tripId, t]);

  const handleStopSharing = useCallback(() => {
    Alert.alert(t('tripShare.stopConfirmTitle'), t('tripShare.stopConfirmBody'), [
      { text: t('common.cancel'), style: 'cancel' },
      {
        text: t('tripShare.stop'),
        style: 'destructive',
        onPress: () => updateTripMutation.mutate(),
      },
    ]);
  }, [updateTripMutation, t]);

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
          <Text accessibilityRole="header" style={[type.sheetTitle, { color: titleColor }]}>
            {t('tripShare.title')}
          </Text>
          <Pressable
            onPress={handleClose}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('tripShare.closeA11y')}
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
              <Text style={[type.bodyStrong, { color: bodyColor, textAlign: 'center' }]}>
                {t('tripShare.archived')}
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
                    backgroundColor: theme.surface2,
                    alignItems: 'center',
                    justifyContent: 'center',
                    marginBottom: 16,
                  }}
                >
                  <Link2 size={28} color={theme.ink2} />
                </View>
                <Text
                  style={[
                    type.sectionTitle,
                    { color: titleColor, marginBottom: 8, textAlign: 'center' },
                  ]}
                >
                  {t('tripShare.generateTitle')}
                </Text>
                <Text style={[type.subhead, { color: bodyColor, textAlign: 'center' }]}>
                  {t('tripShare.generateBody')}
                </Text>
              </View>

              <Pressable
                onPress={handleGenerate}
                disabled={rotateMutation.isPending}
                style={{
                  backgroundColor: theme.warm,
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
                  <ActivityIndicator size="small" color={theme.onWarm} />
                ) : (
                  <Link2 size={18} color={theme.onWarm} />
                )}
                <Text style={[type.bodyStrong, { color: theme.onWarm }]}>
                  {t('tripShare.generateCta')}
                </Text>
              </Pressable>
            </Animated.View>
          ) : (
            <Animated.View entering={FadeInUp.duration(260)}>
              {/* URL display */}
              <Text style={[type.label, { color: mutedColor, marginBottom: 10 }]}>
                {t('tripShare.urlLabel')}
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
                <Text numberOfLines={1} style={[type.subhead, { color: titleColor }]}>
                  {truncate(shareUrl ?? '')}
                </Text>
              </View>

              {/* Info line */}
              <Text
                style={[type.caption, { color: theme.ink3, textAlign: 'center', marginBottom: 16 }]}
              >
                {t('tripShare.info')}
              </Text>

              {/* Action buttons */}
              <View style={{ flexDirection: 'row', gap: 10, marginBottom: 12 }}>
                <Pressable
                  onPress={handleCopy}
                  style={{
                    flex: 1,
                    backgroundColor: theme.warm,
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
                    <Check size={18} color={theme.onWarm} />
                  ) : (
                    <Copy size={18} color={theme.onWarm} />
                  )}
                  <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: theme.onWarm }]}>
                    {justCopied ? t('tripShare.copied') : t('tripShare.copy')}
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
                  <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: titleColor }]}>
                    {t('tripShare.shareSystem')}
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
                <RefreshCw size={15} color={theme.danger} />
                <Text style={[type.label, SYSTEM_WEIGHT.semibold, { color: theme.danger }]}>
                  {t('tripShare.regenerate')}
                </Text>
              </Pressable>

              {/* Warning */}
              <View
                style={{
                  flexDirection: 'row',
                  gap: 10,
                  padding: 14,
                  marginTop: 20,
                  backgroundColor: tint(theme.plateDue, 0.12),
                  borderRadius: 12,
                  borderCurve: 'continuous',
                }}
              >
                <AlertTriangle size={16} color={theme.dueInk} />
                <Text style={[type.caption, { flex: 1, color: bodyColor }]}>
                  {t('tripShare.warning')}
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
                <ActivityIndicator size="small" color={theme.danger} />
              ) : (
                <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: theme.danger }]}>
                  {t('tripShare.stop')}
                </Text>
              )}
            </Pressable>
          </View>
        )}
      </View>
    </Modal>
  );
}
