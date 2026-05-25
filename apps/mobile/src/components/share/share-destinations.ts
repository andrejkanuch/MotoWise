import * as Clipboard from 'expo-clipboard';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import * as Sharing from 'expo-sharing';
import { Alert, Linking } from 'react-native';
import type { ShareDestination, ShareResult } from './share-card-types';

function buildDeepLink(rideId: string): string {
  return `https://motovault.app/r/${rideId}`;
}

async function checkCanOpen(scheme: string): Promise<boolean> {
  try {
    return await Linking.canOpenURL(scheme);
  } catch {
    return false;
  }
}

// ── Instagram Story ─────────────────────────────────────────────────────────

async function shareToInstagramStory(imageUri: string, _deepLink: string): Promise<ShareResult> {
  const canOpen = await checkCanOpen('instagram-stories://share');
  if (!canOpen) {
    return new Promise((resolve) => {
      Alert.alert('Instagram not installed', 'Install Instagram to share stories.', [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve({ success: false, reason: 'unavailable' }),
        },
        {
          text: 'App Store',
          onPress: () => {
            Linking.openURL('https://apps.apple.com/app/instagram/id389801252');
            resolve({ success: false, reason: 'unavailable' });
          },
        },
      ]);
    });
  }

  return new Promise((resolve) => {
    Alert.alert('Open in "Instagram"?', '"MotoVault" will share your ride card to Instagram.', [
      {
        text: 'Cancel',
        style: 'cancel',
        onPress: () => resolve({ success: false, reason: 'cancelled' }),
      },
      {
        text: 'Open',
        isPreferred: true,
        onPress: async () => {
          try {
            await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
            resolve({ success: true });
          } catch {
            resolve({
              success: false,
              reason: 'error',
              message: 'Failed to share to Instagram Story',
            });
          }
        },
      },
    ]);
  });
}

// ── Instagram Messages ──────────────────────────────────────────────────────

async function shareToInstagramMessages(imageUri: string, _deepLink: string): Promise<ShareResult> {
  try {
    await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
    return { success: true };
  } catch {
    return { success: false, reason: 'cancelled' };
  }
}

// ── WhatsApp ────────────────────────────────────────────────────────────────

async function shareToWhatsApp(imageUri: string, _deepLink: string): Promise<ShareResult> {
  const canOpen = await checkCanOpen('whatsapp://send');
  if (!canOpen) {
    return new Promise((resolve) => {
      Alert.alert('WhatsApp not installed', 'Install WhatsApp to share.', [
        {
          text: 'Cancel',
          style: 'cancel',
          onPress: () => resolve({ success: false, reason: 'unavailable' }),
        },
        {
          text: 'App Store',
          onPress: () => {
            Linking.openURL('https://apps.apple.com/app/whatsapp-messenger/id310633997');
            resolve({ success: false, reason: 'unavailable' });
          },
        },
      ]);
    });
  }

  try {
    await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
    return { success: true };
  } catch {
    return { success: false, reason: 'cancelled' };
  }
}

// ── iMessage ────────────────────────────────────────────────────────────────

async function shareToMessage(imageUri: string, _deepLink: string): Promise<ShareResult> {
  try {
    await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
    return { success: true };
  } catch {
    return { success: false, reason: 'cancelled' };
  }
}

// ── MotoVault DM (stub) ─────────────────────────────────────────────────────

async function shareToMotovaultDm(_imageUri: string, _deepLink: string): Promise<ShareResult> {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
  }
  return { success: false, reason: 'unavailable', message: 'Coming soon' };
}

// ── Save Image ──────────────────────────────────────────────────────────────

async function saveImage(imageUri: string, _deepLink: string): Promise<ShareResult> {
  let { status, canAskAgain } = await MediaLibrary.getPermissionsAsync();

  if (status !== 'granted') {
    if (canAskAgain) {
      const result = await MediaLibrary.requestPermissionsAsync();
      status = result.status;
    }
    if (status !== 'granted') {
      return new Promise((resolve) => {
        Alert.alert('Photos access needed', 'Open Settings to allow MotoVault to save images.', [
          {
            text: 'Cancel',
            style: 'cancel',
            onPress: () => resolve({ success: false, reason: 'denied' }),
          },
          {
            text: 'Open Settings',
            onPress: () => {
              Linking.openSettings();
              resolve({ success: false, reason: 'denied' });
            },
          },
        ]);
      });
    }
  }

  try {
    await MediaLibrary.saveToLibraryAsync(imageUri);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    }
    return { success: true };
  } catch {
    return { success: false, reason: 'error', message: 'Failed to save image' };
  }
}

// ── Copy Link ───────────────────────────────────────────────────────────────

async function copyLink(_imageUri: string, deepLink: string): Promise<ShareResult> {
  try {
    await Clipboard.setStringAsync(deepLink);
    if (process.env.EXPO_OS === 'ios') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    return { success: true };
  } catch {
    return { success: false, reason: 'error', message: 'Failed to copy link' };
  }
}

// ── System Share (More) ─────────────────────────────────────────────────────

async function shareToSystem(imageUri: string, _deepLink: string): Promise<ShareResult> {
  try {
    await Sharing.shareAsync(imageUri, { mimeType: 'image/png', UTI: 'public.png' });
    return { success: true };
  } catch {
    return { success: false, reason: 'cancelled' };
  }
}

// ── Handler Registry ────────────────────────────────────────────────────────

type DestinationHandler = (imageUri: string, deepLink: string) => Promise<ShareResult>;

const HANDLERS: Record<ShareDestination, DestinationHandler> = {
  instagramStory: shareToInstagramStory,
  instagramMessages: shareToInstagramMessages,
  whatsapp: shareToWhatsApp,
  message: shareToMessage,
  motovaultDm: shareToMotovaultDm,
  saveImage,
  copyLink,
  systemShare: shareToSystem,
};

/** Execute the share handler for a destination. Returns structured result. */
export async function executeShareDestination(
  destination: ShareDestination,
  imageUri: string,
  rideId: string,
): Promise<ShareResult> {
  const deepLink = buildDeepLink(rideId);
  const handler = HANDLERS[destination];
  return handler(imageUri, deepLink);
}

/** Toast messages for each destination result */
export function getToastMessage(destination: ShareDestination, result: ShareResult): string | null {
  if (destination === 'copyLink' && result.success) return 'Link copied';
  if (destination === 'saveImage' && result.success) return 'Image saved';
  if (destination === 'motovaultDm') return 'Coming soon';
  if (!result.success && result.reason === 'error' && result.message) return result.message;
  return null;
}
