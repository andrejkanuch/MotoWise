import { palette } from '@motovault/design-system';
import { AddExpensePhotoDocument, DeleteExpensePhotoDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Camera, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActionSheetIOS,
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  Pressable,
  Text,
  View,
} from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { gqlFetcher } from '../lib/graphql-client';
import { pickImage, takePhoto, uploadExpensePhoto } from '../lib/image-upload';
import { queryKeys } from '../lib/query-keys';

const MAX_PHOTOS = 3;

type Photo = {
  id: string;
  storagePath: string;
  publicUrl: string;
};

function haptic() {
  if (process.env.EXPO_OS === 'ios') {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  }
}

/**
 * Photo gallery for receipts attached to an expense (MOT-143).
 * Mirrors TaskPhotoGallery but with MAX_PHOTOS=3 and expense-scoped mutations.
 *
 * Only usable after the expense exists (requires expenseId + motorcycleId for cache invalidation).
 */
export function ExpensePhotoGallery({
  expenseId,
  userId,
  motorcycleId,
  photos,
  isDark,
}: {
  expenseId: string;
  userId: string;
  motorcycleId: string;
  photos: Photo[];
  isDark: boolean;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<Photo | null>(null);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
    });
    queryClient.invalidateQueries({ queryKey: ['expense-photos', expenseId] });
  };

  const addPhotoMutation = useMutation({
    mutationFn: (input: { expenseId: string; storagePath: string; fileSizeBytes?: number }) =>
      gqlFetcher(AddExpensePhotoDocument, { input }),
    onSuccess: invalidate,
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => gqlFetcher(DeleteExpensePhotoDocument, { photoId }),
    onSuccess: invalidate,
  });

  const handleUpload = async (uri: string) => {
    try {
      setUploading(true);
      const { storagePath, fileSizeBytes } = await uploadExpensePhoto(uri, userId, expenseId);
      await addPhotoMutation.mutateAsync({ expenseId, storagePath, fileSizeBytes });
    } catch (_err) {
      Alert.alert(
        t('common.error', { defaultValue: 'Error' }),
        t('expenses.photoUploadFailed', { defaultValue: 'Failed to upload photo' }),
      );
    } finally {
      setUploading(false);
    }
  };

  const showAddOptions = () => {
    haptic();
    if (Platform.OS === 'ios') {
      ActionSheetIOS.showActionSheetWithOptions(
        {
          options: [
            t('common.cancel', { defaultValue: 'Cancel' }),
            t('expenses.takeReceiptPhoto', { defaultValue: 'Take Receipt Photo' }),
            t('expenses.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
          ],
          cancelButtonIndex: 0,
        },
        async (buttonIndex) => {
          if (buttonIndex === 1) {
            const uri = await takePhoto();
            if (uri) handleUpload(uri);
          } else if (buttonIndex === 2) {
            const uri = await pickImage();
            if (uri) handleUpload(uri);
          }
        },
      );
    } else {
      Alert.alert(t('expenses.addReceipt', { defaultValue: 'Add Receipt' }), undefined, [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('expenses.takeReceiptPhoto', { defaultValue: 'Take Receipt Photo' }),
          onPress: async () => {
            const uri = await takePhoto();
            if (uri) handleUpload(uri);
          },
        },
        {
          text: t('expenses.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
          onPress: async () => {
            const uri = await pickImage();
            if (uri) handleUpload(uri);
          },
        },
      ]);
    }
  };

  const handleDeletePhoto = (photo: Photo) => {
    haptic();
    Alert.alert(
      t('expenses.deletePhoto', { defaultValue: 'Delete Photo' }),
      t('expenses.confirmDeletePhoto', {
        defaultValue: 'Are you sure you want to delete this receipt?',
      }),
      [
        { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
        {
          text: t('common.delete', { defaultValue: 'Delete' }),
          style: 'destructive',
          onPress: () => deletePhotoMutation.mutate(photo.id),
        },
      ],
    );
  };

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((photo, index) => (
          <Animated.View key={photo.id} entering={FadeIn.delay(index * 50).duration(200)}>
            <Pressable
              onPress={() => {
                haptic();
                setViewingPhoto(photo);
              }}
              onLongPress={() => handleDeletePhoto(photo)}
              style={{
                width: 80,
                height: 80,
                borderRadius: 10,
                borderCurve: 'continuous',
                overflow: 'hidden',
                backgroundColor: isDark ? palette.neutral700 : palette.neutral200,
              }}
            >
              <Image
                source={{ uri: photo.publicUrl }}
                style={{ width: 80, height: 80 }}
                contentFit="cover"
                transition={200}
              />
            </Pressable>
          </Animated.View>
        ))}

        {photos.length < MAX_PHOTOS && (
          <Pressable
            onPress={showAddOptions}
            disabled={uploading}
            style={{
              width: 80,
              height: 80,
              borderRadius: 10,
              borderCurve: 'continuous',
              borderWidth: 1.5,
              borderColor: isDark ? palette.neutral600 : palette.neutral300,
              borderStyle: 'dashed',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? 'rgba(255,255,255,0.03)' : 'rgba(0,0,0,0.02)',
            }}
          >
            {uploading ? (
              <ActivityIndicator size="small" color={palette.primary500} />
            ) : (
              <>
                <Camera size={20} color={palette.neutral400} strokeWidth={1.5} />
                <Text
                  style={{
                    fontSize: 10,
                    color: palette.neutral400,
                    marginTop: 4,
                    fontWeight: '500',
                  }}
                >
                  {photos.length}/{MAX_PHOTOS}
                </Text>
              </>
            )}
          </Pressable>
        )}
      </View>

      <Modal
        visible={viewingPhoto !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setViewingPhoto(null)}
      >
        <View
          style={{
            flex: 1,
            backgroundColor: 'rgba(0,0,0,0.95)',
            justifyContent: 'center',
            alignItems: 'center',
          }}
        >
          {viewingPhoto && (
            <Image
              source={{ uri: viewingPhoto.publicUrl }}
              style={{ width: '100%', height: '80%' }}
              contentFit="contain"
              transition={200}
            />
          )}
          <Pressable
            onPress={() => setViewingPhoto(null)}
            style={{
              position: 'absolute',
              top: 60,
              right: 20,
              width: 40,
              height: 40,
              borderRadius: 20,
              backgroundColor: 'rgba(255,255,255,0.15)',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <X size={22} color={palette.white} strokeWidth={2} />
          </Pressable>
          {viewingPhoto && (
            <Pressable
              onPress={() => {
                const photo = viewingPhoto;
                setViewingPhoto(null);
                handleDeletePhoto(photo);
              }}
              style={{
                position: 'absolute',
                bottom: 60,
                width: 48,
                height: 48,
                borderRadius: 24,
                backgroundColor: 'rgba(239,68,68,0.8)',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Trash2 size={22} color={palette.white} strokeWidth={2} />
            </Pressable>
          )}
        </View>
      </Modal>
    </View>
  );
}
