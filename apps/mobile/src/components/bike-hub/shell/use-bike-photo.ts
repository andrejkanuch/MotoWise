import { UpdateMotorcycleDocument } from '@motovault/graphql';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert } from 'react-native';
import { gqlFetcher } from '@/lib/graphql-client';
import { pickImage, takePhoto, uploadBikePhoto } from '@/lib/image-upload';
import { queryKeys } from '@/lib/query-keys';
import { useAuthStore } from '@/stores/auth.store';
import { showActionSheet } from '@/utils/action-sheet';
import { triggerImpact } from '@/utils/haptics';

/**
 * Take / choose a bike photo, upload it and set it as the bike's primary photo.
 * The flow of the old hero camera button, shared by the interim Bike actions
 * and the Overview photo band.
 */
export function useBikePhoto(bikeId: string): { uploading: boolean; changePhoto: () => void } {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const [uploading, setUploading] = useState(false);

  const { mutateAsync: setPhoto } = useMutation({
    mutationFn: (primaryPhotoUrl: string) =>
      gqlFetcher(UpdateMotorcycleDocument, { id: bikeId, input: { primaryPhotoUrl } }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.motorcycles.all });
    },
    // `changePhoto` shows "Failed to upload photo" itself.
    meta: { showErrorAlert: false },
  });

  const changePhoto = useCallback(() => {
    triggerImpact();
    if (!userId) return;

    const upload = async (uri: string | null) => {
      if (!uri) return;
      try {
        setUploading(true);
        const { publicUrl } = await uploadBikePhoto(uri, userId, bikeId);
        await setPhoto(publicUrl);
      } catch (_error) {
        Alert.alert(
          t('common.error', { defaultValue: 'Error' }),
          t('garage.photoUploadFailed', { defaultValue: 'Failed to upload photo' }),
        );
      } finally {
        setUploading(false);
      }
    };

    showActionSheet(t('garage.addPhoto', { defaultValue: 'Add Photo' }), [
      {
        label: t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
        onPress: async () => upload(await takePhoto()),
      },
      {
        label: t('maintenance.chooseFromLibrary', { defaultValue: 'Choose from Library' }),
        onPress: async () => upload(await pickImage()),
      },
      { label: t('common.cancel', { defaultValue: 'Cancel' }), onPress: () => {}, style: 'cancel' },
    ]);
  }, [bikeId, userId, setPhoto, t]);

  return { uploading, changePhoto };
}
