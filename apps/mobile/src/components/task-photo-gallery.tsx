import { AddTaskPhotoDocument, DeleteTaskPhotoDocument } from '@motovault/graphql';
import { useTranslation } from 'react-i18next';
import { gqlFetcher } from '../lib/graphql-client';
import { uploadMaintenancePhoto } from '../lib/image-upload';
import { queryKeys } from '../lib/query-keys';
import { type GalleryPhoto, PhotoGallery } from './photo-gallery';

const MAX_PHOTOS = 5;

/**
 * Photo gallery for a maintenance task: the shared PhotoGallery with a limit
 * of 5 and task-scoped upload, mutations and copy.
 */
export function TaskPhotoGallery({
  taskId,
  userId,
  motorcycleId,
  photos,
  isDark,
}: {
  taskId: string;
  userId: string;
  motorcycleId: string;
  photos: GalleryPhoto[];
  isDark: boolean;
}) {
  const { t } = useTranslation();

  return (
    <PhotoGallery
      photos={photos}
      isDark={isDark}
      config={{
        maxPhotos: MAX_PHOTOS,
        upload: (uri) => uploadMaintenancePhoto(uri, userId, taskId),
        addPhoto: (photo) => gqlFetcher(AddTaskPhotoDocument, { input: { taskId, ...photo } }),
        deletePhoto: (photoId) => gqlFetcher(DeleteTaskPhotoDocument, { photoId }),
        invalidate: (queryClient) =>
          queryClient.invalidateQueries({
            queryKey: queryKeys.maintenanceTasks.byMotorcycle(motorcycleId),
          }),
        labels: {
          uploadFailed: t('maintenance.photoUploadFailed', {
            defaultValue: 'Failed to upload photo',
          }),
          addTitle: t('maintenance.addPhoto', { defaultValue: 'Add Photo' }),
          takePhoto: t('maintenance.takePhoto', { defaultValue: 'Take Photo' }),
          chooseFromLibrary: t('maintenance.chooseFromLibrary', {
            defaultValue: 'Choose from Library',
          }),
          deleteTitle: t('maintenance.deletePhoto', { defaultValue: 'Delete Photo' }),
          deleteMessage: t('maintenance.confirmDeletePhoto', {
            defaultValue: 'Are you sure you want to delete this photo?',
          }),
        },
      }}
    />
  );
}
