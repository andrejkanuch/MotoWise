import { AddExpensePhotoDocument, DeleteExpensePhotoDocument } from '@motovault/graphql';
import { useTranslation } from 'react-i18next';
import { gqlFetcher } from '../lib/graphql-client';
import { uploadExpensePhoto } from '../lib/image-upload';
import { queryKeys } from '../lib/query-keys';
import { type GalleryPhoto, PhotoGallery } from './photo-gallery';

const MAX_PHOTOS = 3;

/**
 * Photo gallery for receipts attached to an expense (MOT-143): the shared
 * PhotoGallery with a limit of 3 and expense-scoped upload, mutations and copy.
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
        upload: (uri) => uploadExpensePhoto(uri, userId, expenseId),
        addPhoto: (photo) =>
          gqlFetcher(AddExpensePhotoDocument, { input: { expenseId, ...photo } }),
        deletePhoto: (photoId) => gqlFetcher(DeleteExpensePhotoDocument, { photoId }),
        invalidate: (queryClient) => {
          queryClient.invalidateQueries({
            queryKey: queryKeys.expenses.byMotorcycle(motorcycleId),
          });
          queryClient.invalidateQueries({ queryKey: queryKeys.expensePhotos.byExpense(expenseId) });
        },
        labels: {
          uploadFailed: t('expenses.photoUploadFailed', { defaultValue: 'Failed to upload photo' }),
          addTitle: t('expenses.addReceipt', { defaultValue: 'Add Receipt' }),
          takePhoto: t('expenses.takeReceiptPhoto', { defaultValue: 'Take Receipt Photo' }),
          chooseFromLibrary: t('expenses.chooseFromLibrary', {
            defaultValue: 'Choose from Library',
          }),
          deleteTitle: t('expenses.deletePhoto', { defaultValue: 'Delete Photo' }),
          deleteMessage: t('expenses.confirmDeletePhoto', {
            defaultValue: 'Are you sure you want to delete this receipt?',
          }),
        },
      }}
    />
  );
}
