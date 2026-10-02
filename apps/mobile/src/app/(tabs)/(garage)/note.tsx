import { router, useLocalSearchParams } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';
import { useNotes } from '../../../components/bike-hub/notes/use-notes';
import { NoteForm } from '../../../components/bike-hub/sheets/note-form';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { hub } from '../../../components/bike-hub/ui/tokens';

type NoteRouteParams = {
  motorcycleId: string;
  /** Edit this note instead of writing a new one. */
  noteId?: string;
  /** Text already typed in a quick-add field. */
  draft?: string;
  /** Present = open the photo picker on arrival. */
  photo?: string;
};

/** Note sheet route (formSheet, large detent): new note, or edit with `noteId`. */
export default function NoteScreen() {
  const { motorcycleId, noteId, draft, photo } = useLocalSearchParams<NoteRouteParams>();
  const { bike, bikes } = useHubBike(motorcycleId);
  const { notes, isLoading } = useNotes(motorcycleId);
  const note = noteId ? notes.find((candidate) => candidate.id === noteId) : undefined;

  if (!bike || (noteId && !note && isLoading)) {
    return (
      <View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          backgroundColor: hub.card,
        }}
      >
        <ActivityIndicator color={hub.copper} />
      </View>
    );
  }
  return (
    <NoteForm
      // Edit state is seeded from the note once; a different note is a fresh form.
      key={noteId ?? 'new'}
      bike={bike}
      bikes={bikes}
      note={note}
      draft={draft}
      openPhotoPicker={!!photo}
      onClose={() => router.back()}
    />
  );
}
