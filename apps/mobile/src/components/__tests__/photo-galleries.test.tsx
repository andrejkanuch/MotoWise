/**
 * Pins the two photo galleries by their differences before they share one body
 * (plan U20, R19). The two files are otherwise line-for-line the same, so every
 * scenario runs against both and asserts only what sets them apart: the photo
 * limit, the upload function, the add and delete documents and the owner field
 * on the add input, what is invalidated after a change, and the copy keys.
 *
 * `t` returns its key so the two galleries can be told apart where `en.json`
 * gives both the same English ("Delete Photo").
 */
jest.mock('react-i18next', () => ({ useTranslation: () => ({ t: (key: string) => key }) }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light' },
}));
jest.mock('expo-image', () => {
  const { View } = require('react-native');
  return { Image: (props: Record<string, unknown>) => <View testID="photo" {...props} /> };
});

const mockPick = jest.fn();
const mockTake = jest.fn();
const mockUploadExpense = jest.fn();
const mockUploadMaintenance = jest.fn();
jest.mock('@/lib/image-upload', () => ({
  pickImage: () => mockPick(),
  takePhoto: () => mockTake(),
  uploadExpensePhoto: (...args: unknown[]) => mockUploadExpense(...args),
  uploadMaintenancePhoto: (...args: unknown[]) => mockUploadMaintenance(...args),
}));

type SheetOption = { label: string; onPress: () => void | Promise<void> };
const mockShowActionSheet = jest.fn<void, [string, SheetOption[]]>();
jest.mock('@/utils/action-sheet', () => ({
  showActionSheet: (title: string, options: SheetOption[]) => mockShowActionSheet(title, options),
}));

const mockFetcher = jest.fn();
jest.mock('@/lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  AddExpensePhotoDocument,
  AddTaskPhotoDocument,
  DeleteExpensePhotoDocument,
  DeleteTaskPhotoDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react-native';
import type { ReactElement } from 'react';
import { Alert } from 'react-native';
import { queryKeys } from '@/lib/query-keys';
import { ExpensePhotoGallery } from '../expense-photo-gallery';
import { TaskPhotoGallery } from '../task-photo-gallery';

const USER_ID = 'user-1';
const MOTORCYCLE_ID = 'bike-1';
const OWNER_ID = 'owner-1';
const PICKED_URI = 'file:///picked.jpg';
const UPLOADED = { storagePath: 'u/owner-1/photo.webp', fileSizeBytes: 1234 };

type Photo = { id: string; storagePath: string; publicUrl: string };
const photoList = (count: number): Photo[] =>
  Array.from({ length: count }, (_, i) => ({
    id: `photo-${i + 1}`,
    storagePath: `u/${i + 1}.webp`,
    publicUrl: `https://cdn/${i + 1}.webp`,
  }));

/** One row per gallery: exactly what `diff expense-photo-gallery.tsx task-photo-gallery.tsx` shows. */
const GALLERIES = [
  {
    name: 'ExpensePhotoGallery',
    limit: 3,
    render: (photos: Photo[]): ReactElement => (
      <ExpensePhotoGallery
        expenseId={OWNER_ID}
        userId={USER_ID}
        motorcycleId={MOTORCYCLE_ID}
        photos={photos}
        isDark={false}
      />
    ),
    upload: mockUploadExpense,
    otherUpload: mockUploadMaintenance,
    addDocument: AddExpensePhotoDocument,
    addInput: { expenseId: OWNER_ID, ...UPLOADED },
    deleteDocument: DeleteExpensePhotoDocument,
    invalidated: [
      queryKeys.expenses.byMotorcycle(MOTORCYCLE_ID),
      queryKeys.expensePhotos.byExpense(OWNER_ID),
    ],
    keys: {
      uploadFailed: 'expenses.photoUploadFailed',
      sheetTitle: 'expenses.addReceipt',
      takePhoto: 'expenses.takeReceiptPhoto',
      chooseFromLibrary: 'expenses.chooseFromLibrary',
      deleteTitle: 'expenses.deletePhoto',
      deleteMessage: 'expenses.confirmDeletePhoto',
    },
  },
  {
    name: 'TaskPhotoGallery',
    limit: 5,
    render: (photos: Photo[]): ReactElement => (
      <TaskPhotoGallery
        taskId={OWNER_ID}
        userId={USER_ID}
        motorcycleId={MOTORCYCLE_ID}
        photos={photos}
        isDark={false}
      />
    ),
    upload: mockUploadMaintenance,
    otherUpload: mockUploadExpense,
    addDocument: AddTaskPhotoDocument,
    addInput: { taskId: OWNER_ID, ...UPLOADED },
    deleteDocument: DeleteTaskPhotoDocument,
    invalidated: [queryKeys.maintenanceTasks.byMotorcycle(MOTORCYCLE_ID)],
    keys: {
      uploadFailed: 'maintenance.photoUploadFailed',
      sheetTitle: 'maintenance.addPhoto',
      takePhoto: 'maintenance.takePhoto',
      chooseFromLibrary: 'maintenance.chooseFromLibrary',
      deleteTitle: 'maintenance.deletePhoto',
      deleteMessage: 'maintenance.confirmDeletePhoto',
    },
  },
] as const;

const clients: QueryClient[] = [];

async function renderGallery(element: ReactElement) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  await render(<QueryClientProvider client={client}>{element}</QueryClientProvider>);
  return { client, invalidate };
}

/** The add tile shows `n/limit`; it is the only text the gallery renders. */
const counter = (count: number, limit: number) => `${count}/${limit}`;

/** Opens the add sheet and chooses "take photo" (the first option). */
async function pressAddAndTakePhoto(count: number, limit: number) {
  await fireEvent.press(screen.getByText(counter(count, limit)));
  const [, options] = mockShowActionSheet.mock.calls[0];
  await act(async () => {
    await options[0].onPress();
  });
}

/** Lets the upload's `finally` clear the spinner after the last awaited assertion. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 0));
  });
}

/** Long-presses the first photo and confirms the delete alert's destructive button. */
async function longPressFirstPhotoAndConfirm(alert: jest.SpyInstance) {
  await fireEvent(screen.getAllByTestId('photo')[0], 'longPress');
  const buttons = alert.mock.calls[0][2] as Array<{ style?: string; onPress?: () => void }>;
  await act(async () => {
    buttons.find((b) => b.style === 'destructive')?.onPress?.();
  });
}

beforeEach(() => {
  jest.clearAllMocks();
  mockTake.mockResolvedValue(PICKED_URI);
  mockPick.mockResolvedValue(PICKED_URI);
  mockUploadExpense.mockResolvedValue(UPLOADED);
  mockUploadMaintenance.mockResolvedValue(UPLOADED);
  mockFetcher.mockResolvedValue({});
});
afterEach(() => {
  for (const client of clients.splice(0)) client.clear();
});

describe.each(GALLERIES)('$name', (gallery) => {
  const { limit, keys } = gallery;

  it(`shows the add tile below ${limit} photos and hides it at ${limit}`, async () => {
    const below = await renderGallery(gallery.render(photoList(limit - 1)));
    expect(screen.getByText(counter(limit - 1, limit))).toBeOnTheScreen();
    below.client.clear();
    await screen.unmount();

    await renderGallery(gallery.render(photoList(limit)));
    expect(screen.queryByText(counter(limit, limit))).toBeNull();
    expect(screen.getAllByTestId('photo')).toHaveLength(limit);
  });

  it('uploads a taken photo with the user id and the owner id, then adds it under its own field', async () => {
    await renderGallery(gallery.render(photoList(1)));
    await pressAddAndTakePhoto(1, limit);

    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(1));
    expect(gallery.upload).toHaveBeenCalledWith(PICKED_URI, USER_ID, OWNER_ID);
    expect(gallery.otherUpload).not.toHaveBeenCalled();
    expect(mockFetcher).toHaveBeenCalledWith(gallery.addDocument, { input: gallery.addInput });
    await flush();
  });

  it('invalidates its own queries after an add', async () => {
    const { invalidate } = await renderGallery(gallery.render(photoList(1)));
    await pressAddAndTakePhoto(1, limit);

    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(gallery.invalidated.length));
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      gallery.invalidated,
    );
    await flush();
  });

  it('offers its own sheet title and option labels', async () => {
    await renderGallery(gallery.render(photoList(1)));
    await fireEvent.press(screen.getByText(counter(1, limit)));

    const [title, options] = mockShowActionSheet.mock.calls[0];
    expect(title).toBe(keys.sheetTitle);
    expect(options.map((o) => o.label)).toEqual([
      keys.takePhoto,
      keys.chooseFromLibrary,
      'common.cancel',
    ]);
  });

  it('shows its own failure title when the upload fails', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    gallery.upload.mockRejectedValueOnce(new Error('offline'));
    await renderGallery(gallery.render(photoList(1)));
    await pressAddAndTakePhoto(1, limit);

    await waitFor(() => expect(alert).toHaveBeenCalledTimes(1));
    expect(alert).toHaveBeenCalledWith('common.error', keys.uploadFailed);
    expect(mockFetcher).not.toHaveBeenCalled();
    await flush();
    alert.mockRestore();
  });

  it('confirms a delete with its own copy and deletes by photo id, then invalidates', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    const { invalidate } = await renderGallery(gallery.render(photoList(2)));
    await longPressFirstPhotoAndConfirm(alert);

    expect(alert).toHaveBeenCalledWith(keys.deleteTitle, keys.deleteMessage, expect.any(Array));
    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(1));
    expect(mockFetcher).toHaveBeenCalledWith(gallery.deleteDocument, { photoId: 'photo-1' });
    await waitFor(() => expect(invalidate).toHaveBeenCalledTimes(gallery.invalidated.length));
    expect(invalidate.mock.calls.map(([filters]) => filters?.queryKey)).toEqual(
      gallery.invalidated,
    );
    alert.mockRestore();
  });

  it('ignores a repeat long-press on the photo being deleted and keeps the others deletable', async () => {
    const alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
    // The delete's refetch never lands (offline after a successful delete).
    mockFetcher.mockReturnValue(new Promise(() => {}));
    await renderGallery(gallery.render(photoList(2)));
    await longPressFirstPhotoAndConfirm(alert);
    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(1));
    await flush();
    alert.mockClear();

    await fireEvent(screen.getAllByTestId('photo')[0], 'longPress');
    expect(alert).not.toHaveBeenCalled();

    await fireEvent(screen.getAllByTestId('photo')[1], 'longPress');
    expect(alert).toHaveBeenCalledWith(keys.deleteTitle, keys.deleteMessage, expect.any(Array));

    // Confirming the second delete must not unguard the first, still-pending one.
    const buttons = alert.mock.calls[0][2] as Array<{ style?: string; onPress?: () => void }>;
    await act(async () => {
      buttons.find((b) => b.style === 'destructive')?.onPress?.();
    });
    await waitFor(() => expect(mockFetcher).toHaveBeenCalledTimes(2));
    await flush();
    alert.mockClear();
    await fireEvent(screen.getAllByTestId('photo')[0], 'longPress');
    await fireEvent(screen.getAllByTestId('photo')[1], 'longPress');
    expect(alert).not.toHaveBeenCalled();
    alert.mockRestore();
  });
});
