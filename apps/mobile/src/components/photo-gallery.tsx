import { palette } from '@motovault/design-system';
import { type QueryClient, useMutation, useQueryClient } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { Camera, Trash2, X } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Alert, Modal, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { pickImage, takePhoto } from '../lib/image-upload';
import { tint } from '../theme/editorial';
import { showActionSheet } from '../utils/action-sheet';
import { triggerImpact } from '../utils/haptics';

export type GalleryPhoto = {
  id: string;
  storagePath: string;
  publicUrl: string;
};

export type UploadedPhoto = { storagePath: string; fileSizeBytes: number };

/**
 * What sets one gallery apart from another. The wrapper (ExpensePhotoGallery,
 * TaskPhotoGallery) builds it from its own props and translation keys.
 */
export type PhotoGalleryConfig = {
  /** The add tile is hidden once this many photos are attached. */
  maxPhotos: number;
  /** Puts the picked image in storage under this owner. */
  upload: (uri: string) => Promise<UploadedPhoto>;
  /** Records the uploaded photo on this owner. */
  addPhoto: (photo: UploadedPhoto) => Promise<unknown>;
  deletePhoto: (photoId: string) => Promise<unknown>;
  /**
   * Runs after an add or a delete succeeds. Returns the refetch so the mutation
   * stays pending until `photos` is fresh; a second tap on a photo that is
   * already deleted would otherwise hit the server again and fail silently.
   */
  invalidate: (queryClient: QueryClient) => Promise<unknown>;
  labels: {
    uploadFailed: string;
    addTitle: string;
    takePhoto: string;
    chooseFromLibrary: string;
    deleteTitle: string;
    deleteMessage: string;
  };
};

/**
 * Thumbnail strip with an add tile, a full-screen viewer and long-press delete.
 * One body for every photo owner; `config` carries the owner-specific parts.
 */
export function PhotoGallery({
  photos,
  isDark,
  config,
}: {
  photos: GalleryPhoto[];
  isDark: boolean;
  config: PhotoGalleryConfig;
}) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState(false);
  const [viewingPhoto, setViewingPhoto] = useState<GalleryPhoto | null>(null);
  const { maxPhotos, labels } = config;

  const invalidate = () => config.invalidate(queryClient);

  const addPhotoMutation = useMutation({
    mutationFn: (photo: UploadedPhoto) => config.addPhoto(photo),
    onSuccess: invalidate,
  });

  const deletePhotoMutation = useMutation({
    mutationFn: (photoId: string) => config.deletePhoto(photoId),
    onSuccess: invalidate,
  });

  const handleUpload = async (uri: string) => {
    try {
      setUploading(true);
      const uploaded = await config.upload(uri);
      await addPhotoMutation.mutateAsync(uploaded);
    } catch (_err) {
      Alert.alert(t('common.error', { defaultValue: 'Error' }), labels.uploadFailed);
    } finally {
      setUploading(false);
    }
  };

  const showAddOptions = () => {
    triggerImpact();
    showActionSheet(labels.addTitle, [
      {
        label: labels.takePhoto,
        onPress: async () => {
          const uri = await takePhoto();
          if (uri) handleUpload(uri);
        },
      },
      {
        label: labels.chooseFromLibrary,
        onPress: async () => {
          const uri = await pickImage();
          if (uri) handleUpload(uri);
        },
      },
      {
        label: t('common.cancel', { defaultValue: 'Cancel' }),
        onPress: () => {},
        style: 'cancel',
      },
    ]);
  };

  const handleDeletePhoto = (photo: GalleryPhoto) => {
    if (deletePhotoMutation.isPending) return;
    triggerImpact();
    Alert.alert(labels.deleteTitle, labels.deleteMessage, [
      { text: t('common.cancel', { defaultValue: 'Cancel' }), style: 'cancel' },
      {
        text: t('common.delete', { defaultValue: 'Delete' }),
        style: 'destructive',
        onPress: () => deletePhotoMutation.mutate(photo.id),
      },
    ]);
  };

  return (
    <View style={{ marginTop: 8 }}>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {photos.map((photo, index) => (
          <Animated.View key={photo.id} entering={FadeIn.delay(index * 50).duration(200)}>
            <Pressable
              onPress={() => {
                triggerImpact();
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

        {photos.length < maxPhotos && (
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
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: isDark ? tint(palette.whitePure, 0.03) : tint(palette.black, 0.02),
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
                  {photos.length}/{maxPhotos}
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
            backgroundColor: tint(palette.black, 0.95),
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
              backgroundColor: palette.whiteAlpha15,
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
                backgroundColor: tint(palette.plateRed, 0.8),
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
