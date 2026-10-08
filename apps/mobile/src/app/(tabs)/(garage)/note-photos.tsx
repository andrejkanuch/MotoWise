import { NOTE_PHOTOS_MAX } from '@motovault/types';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { NotePhotoViewer } from '../../../components/bike-hub/notes/note-photo-viewer';
import { useNotes } from '../../../components/bike-hub/notes/use-notes';
import { hub } from '../../../components/bike-hub/ui/tokens';

type NotePhotosRouteParams = {
  motorcycleId: string;
  noteId: string;
  /** The photo to open on, 0-based. */
  index?: string;
};

/** Full-screen photo viewer of one note (fullScreenModal over the Notes screen). */
export default function NotePhotosRoute() {
  const { motorcycleId, noteId, index } = useLocalSearchParams<NotePhotosRouteParams>();
  const { notes, isLoading } = useNotes(motorcycleId);
  const note = notes.find((candidate) => candidate.id === noteId);
  const photos = (note?.photos ?? []).slice(0, NOTE_PHOTOS_MAX).map((photo) => ({
    id: photo.id,
    storagePath: photo.storagePath,
    uri: photo.publicUrl,
  }));
  const requested = Number.parseInt(index ?? '0', 10);
  const initialIndex = Number.isNaN(requested)
    ? 0
    : Math.min(Math.max(requested, 0), Math.max(photos.length - 1, 0));

  // A note or photo that is gone (deleted elsewhere, a stale link): nothing to show.
  const missing = !isLoading && photos.length === 0;
  useEffect(() => {
    if (missing) router.back();
  }, [missing]);

  if (photos.length === 0) {
    return (
      <View
        testID="note-photos-loading"
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hub.ground,
        }}
      >
        <ActivityIndicator color={hub.copper} />
      </View>
    );
  }
  return (
    <NotePhotoViewer photos={photos} initialIndex={initialIndex} onClose={() => router.back()} />
  );
}
