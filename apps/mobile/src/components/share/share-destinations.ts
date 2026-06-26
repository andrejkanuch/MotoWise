import { File } from 'expo-file-system';
import * as Haptics from 'expo-haptics';
import * as MediaLibrary from 'expo-media-library';
import { Alert, Linking } from 'react-native';
import RNShare, { Social } from 'react-native-share';
import i18n from '../../i18n';
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

function showInstallAlert(
  title: string,
  message: string,
  appStoreUrl: string,
): Promise<ShareResult> {
  return new Promise((resolve) => {
    Alert.alert(title, message, [
      {
        text: i18n.t('shareSheet.cancel'),
        style: 'cancel',
        onPress: () => resolve({ success: false, reason: 'unavailable' }),
      },
      {
        text: i18n.t('shareSheet.appStore'),
        onPress: () => {
          Linking.openURL(appStoreUrl);
          resolve({ success: false, reason: 'unavailable' });
        },
      },
    ]);
  });
}

/** Convert a file URI to a base64 data URI for react-native-share compatibility */
async function toBase64DataUri(fileUri: string): Promise<string> {
  const file = new File(fileUri);
  const base64 = await file.base64();
  return `data:image/png;base64,${base64}`;
}

// ── Instagram Story ─────────────────────────────────────────────────────────

async function shareToInstagramStory(imageUri: string, deepLink: string): Promise<ShareResult> {
  const canOpen = await checkCanOpen('instagram-stories://share');
  if (!canOpen) {
    return showInstallAlert(
      i18n.t('shareSheet.instagramNotInstalled'),
      i18n.t('shareSheet.installInstagram'),
      'https://apps.apple.com/app/instagram/id389801252',
    );
  }

  try {
    const dataUri = await toBase64DataUri(imageUri);
    await RNShare.shareSingle({
      social: Social.InstagramStories,
      appId: 'motovault',
      backgroundImage: dataUri,
      attributionURL: deepLink,
    });
    return { success: true };
  } catch {
    return { success: false, reason: 'cancelled' };
  }
}

// ── Instagram Messages ──────────────────────────────────────────────────────

async function shareToInstagramMessages(imageUri: string, _deepLink: string): Promise<ShareResult> {
  const canOpen = await checkCanOpen('instagram://');
  if (!canOpen) {
    return showInstallAlert(
      i18n.t('shareSheet.instagramNotInstalled'),
      i18n.t('shareSheet.installInstagram'),
      'https://apps.apple.com/app/instagram/id389801252',
    );
  }

  try {
    const dataUri = await toBase64DataUri(imageUri);
    await RNShare.shareSingle({
      social: Social.Instagram,
      url: dataUri,
      type: 'image/png',
    });
    return { success: true };
  } catch {
    return { success: false, reason: 'cancelled' };
  }
}

// ── Save Image ──────────────────────────────────────────────────────────────

async function saveImage(imageUri: string, _deepLink: string): Promise<ShareResult> {
  // Write-only: we only save share cards, never read the library. This avoids
  // requesting READ_MEDIA_IMAGES/READ_MEDIA_VIDEO (stripped from the Android
  // manifest to comply with Google Play's Photo and Video Permissions policy)
  // and maps to add-only access on iOS (NSPhotoLibraryAddUsageDescription).
  const WRITE_ONLY = true;
  let { status, canAskAgain } = await MediaLibrary.getPermissionsAsync(WRITE_ONLY);

  if (status !== 'granted') {
    if (canAskAgain) {
      const result = await MediaLibrary.requestPermissionsAsync(WRITE_ONLY);
      status = result.status;
    }
    if (status !== 'granted') {
      return new Promise((resolve) => {
        Alert.alert(
          i18n.t('shareSheet.photosAccessNeeded'),
          i18n.t('shareSheet.openSettingsForPhotos'),
          [
            {
              text: i18n.t('shareSheet.cancel'),
              style: 'cancel',
              onPress: () => resolve({ success: false, reason: 'denied' }),
            },
            {
              text: i18n.t('shareSheet.openSettings'),
              onPress: () => {
                Linking.openSettings();
                resolve({ success: false, reason: 'denied' });
              },
            },
          ],
        );
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
    return { success: false, reason: 'error', message: i18n.t('shareSheet.saveImageFailed') };
  }
}

// ── Handler Registry ────────────────────────────────────────────────────────

type DestinationHandler = (imageUri: string, deepLink: string) => Promise<ShareResult>;

const HANDLERS: Record<ShareDestination, DestinationHandler> = {
  instagramStory: shareToInstagramStory,
  instagramMessages: shareToInstagramMessages,
  saveImage,
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
  if (destination === 'saveImage' && result.success) return i18n.t('shareSheet.imageSaved');
  if (!result.success && result.reason === 'error' && result.message) return result.message;
  return null;
}
