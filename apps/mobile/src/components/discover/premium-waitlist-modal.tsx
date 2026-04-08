import { palette } from '@motovault/design-system';
import { JoinPremiumWaitlistDocument } from '@motovault/graphql';
import { useMutation } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { CloudOff, Sparkles } from 'lucide-react-native';
import { memo, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, Text, useColorScheme, View } from 'react-native';
import { gqlFetcher } from '../../lib/graphql-client';

interface PremiumWaitlistModalProps {
  visible: boolean;
  onClose: () => void;
}

export const PremiumWaitlistModal = memo(function PremiumWaitlistModal({
  visible,
  onClose,
}: PremiumWaitlistModalProps) {
  const isDark = useColorScheme() === 'dark';
  const [joined, setJoined] = useState(false);

  const bg = isDark ? palette.cardDark : palette.white;
  const textColor = isDark ? palette.white : palette.neutral950;
  const subtitleColor = isDark ? palette.neutral400 : palette.neutral500;

  const mutation = useMutation({
    mutationFn: () => gqlFetcher(JoinPremiumWaitlistDocument, { feature: 'offline_routes' }),
    onSuccess: () => {
      setJoined(true);
      if (process.env.EXPO_OS === 'ios') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
  });

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <Pressable
        onPress={onClose}
        style={{
          flex: 1,
          backgroundColor: 'rgba(0,0,0,0.6)',
          justifyContent: 'center',
          alignItems: 'center',
        }}
      >
        <Pressable
          onPress={(e) => e.stopPropagation()}
          style={{
            backgroundColor: bg,
            borderRadius: 24,
            borderCurve: 'continuous',
            padding: 24,
            marginHorizontal: 24,
            width: '90%',
            maxWidth: 360,
            gap: 16,
            alignItems: 'center',
          }}
        >
          <View
            style={{
              width: 56,
              height: 56,
              borderRadius: 28,
              backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            {joined ? (
              <Sparkles size={28} color={palette.accent500} />
            ) : (
              <CloudOff size={28} color={palette.accent500} />
            )}
          </View>

          <Text style={{ fontSize: 18, fontWeight: '800', color: textColor, textAlign: 'center' }}>
            {joined ? "You're on the list!" : 'Offline Routes'}
          </Text>

          <Text style={{ fontSize: 14, lineHeight: 20, color: subtitleColor, textAlign: 'center' }}>
            {joined
              ? "We'll notify you when MotoVault Premium launches with offline route downloads."
              : 'Download routes for offline access — coming soon with MotoVault Premium.'}
          </Text>

          {joined ? (
            <Pressable
              onPress={onClose}
              style={{
                width: '100%',
                paddingVertical: 14,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: palette.accent500,
                alignItems: 'center',
              }}
            >
              <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>Done</Text>
            </Pressable>
          ) : (
            <Pressable
              onPress={() => mutation.mutate()}
              disabled={mutation.isPending}
              style={{
                width: '100%',
                paddingVertical: 14,
                borderRadius: 12,
                borderCurve: 'continuous',
                backgroundColor: palette.accent500,
                alignItems: 'center',
              }}
            >
              {mutation.isPending ? (
                <ActivityIndicator size="small" color={palette.white} />
              ) : (
                <Text style={{ fontSize: 15, fontWeight: '700', color: palette.white }}>
                  Join the Waitlist
                </Text>
              )}
            </Pressable>
          )}
        </Pressable>
      </Pressable>
    </Modal>
  );
});
