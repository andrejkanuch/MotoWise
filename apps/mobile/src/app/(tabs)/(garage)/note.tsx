import { router, useLocalSearchParams, useNavigation } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { useNotes } from '../../../components/bike-hub/notes/use-notes';
import { NoteForm } from '../../../components/bike-hub/sheets/note-form';
import { useHubBike } from '../../../components/bike-hub/shell/use-hub-bike';
import { useHubTheme } from '../../../components/bike-hub/ui/tokens';

type NoteRouteParams = {
  motorcycleId: string;
  /** Edit this note instead of writing a new one. */
  noteId?: string;
  /** Text already typed in a quick-add field. */
  draft?: string;
  /** Present = open the photo picker once the sheet has finished presenting. */
  photo?: string;
};

/** The one native-stack event this screen listens to; `useNavigation` is untyped for it. */
interface TransitionEvents {
  addListener: (
    event: 'transitionEnd',
    listener: (event: { data: { closing: boolean } }) => void,
  ) => () => void;
}

/**
 * Note sheet route (formSheet, large detent): new note, or edit with `noteId`.
 * Work an Android drag-down took away is restored by the form itself, per bike
 * (new note) or per note (edit) — see `NoteForm` and `restorableNoteDraft`.
 */
export default function NoteScreen() {
  const hub = useHubTheme();
  const { motorcycleId, noteId, draft, photo } = useLocalSearchParams<NoteRouteParams>();
  const navigation = useNavigation();
  const { bike, bikes, isLoading: bikeLoading } = useHubBike(motorcycleId);
  const { notes, isLoading: notesLoading } = useNotes(motorcycleId);
  const note = noteId ? notes.find((candidate) => candidate.id === noteId) : undefined;

  // The photo sheet may only open after this sheet's own presenting transition.
  // If the event never arrives the rider taps "Photo" — nothing opens by itself.
  const [presented, setPresented] = useState(false);
  useEffect(() => {
    const events = navigation as unknown as TransitionEvents;
    return events.addListener('transitionEnd', (event) => {
      if (!event.data.closing) setPresented(true);
    });
  }, [navigation]);

  // An id that resolves to nothing once the data is in (deleted elsewhere, a
  // stale link) must never fall through to "new note" with the edit title gone.
  const noteMissing = !!noteId && !note && !notesLoading;
  const bikeMissing = !bike && !bikeLoading;
  const unusable = noteMissing || bikeMissing;
  useEffect(() => {
    if (unusable) router.back();
  }, [unusable]);

  if (!bike || unusable || (noteId && !note)) {
    return (
      <View
        testID="note-sheet-loading"
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
      openPhotoPicker={!!photo && presented}
      onClose={() => router.back()}
    />
  );
}
