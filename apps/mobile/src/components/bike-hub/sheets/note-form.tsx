import {
  AddNotePhotoDocument,
  DeleteNotePhotoDocument,
  NotesByMotorcycleDocument,
} from '@motovault/graphql';
import {
  deriveTaskTitleFromNote,
  NOTE_PHOTOS_MAX,
  NOTE_TASK_TITLE_FALLBACK,
  NOTE_TEXT_MAX,
} from '@motovault/types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Camera, Gauge, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import {
  ActivityIndicator,
  Alert,
  Pressable,
  ScrollView,
  Text,
  TextInput,
  View,
} from 'react-native';
import {
  KeyboardAwareScrollView,
  KeyboardStickyView,
  useKeyboardState,
} from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { NOTE_SOURCE } from '../../../lib/bike-hub/constants';
import {
  bikeDisplayName,
  formatOdometer,
  hasOdometer,
  toHubUnit,
} from '../../../lib/bike-hub/format';
import { normaliseNoteText } from '../../../lib/bike-hub/notes';
import { gqlFetcher } from '../../../lib/graphql-client';
import {
  pickImage,
  removeNotePhotoObject,
  takePhoto,
  uploadNotePhoto,
} from '../../../lib/image-upload';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { showActionSheet } from '../../../utils/action-sheet';
import { triggerImpact, triggerNotification, triggerSelection } from '../../../utils/haptics';
import { NativeToggle } from '../../ui/native-toggle';
import { NotePhoto, rememberLocalNotePhoto } from '../notes/note-photo';
import { type HubNote, useCreateNote, useUpdateNote } from '../notes/use-notes';
import type { HubBike } from '../shell/use-bike-hub-data';
import { HUB_FONT, HUB_HEIGHT, HUB_RADIUS, HUB_TOUCH_TARGET, hub } from '../ui/tokens';

const CHIP_SLOP = Math.ceil((HUB_TOUCH_TARGET - HUB_HEIGHT.small) / 2);
const THUMBNAIL = 64;
const INPUT_LINE_HEIGHT = 23;
const INPUT_PADDING = 14;
const MIN_INPUT_HEIGHT = 6 * INPUT_LINE_HEIGHT + 2 * INPUT_PADDING;
/**
 * With the keyboard up the field starts at four lines (it still grows with the
 * text), so "Also make it a task" stays above the keyboard-attached Save bar.
 */
const MIN_INPUT_HEIGHT_TYPING = 4 * INPUT_LINE_HEIGHT + 2 * INPUT_PADDING;
/** Gap the Save bar keeps above the keyboard (the rest of its bottom padding slides under it). */
const FOOTER_KEYBOARD_GAP = 12;
/** Save bar part above the keyboard before its first layout: top padding + button + gap. */
const FOOTER_FALLBACK_HEIGHT = 12 + HUB_HEIGHT.primary + FOOTER_KEYBOARD_GAP;
/** Room between the focused field's caret and the top of the Save bar. */
const CARET_MARGIN = 8;

interface UploadedPhoto {
  storagePath: string;
  fileSizeBytes: number;
}

/** An uploaded object whose `addNotePhoto` has not been confirmed. */
export interface PendingNotePhoto extends UploadedPhoto {
  /** Bike of the note — the notes query that lists the note's attached photos. */
  motorcycleId: string;
}

/**
 * Deletes uploaded objects that never got a `note_photos` row. An unconfirmed
 * `addNotePhoto` may still have committed (its response lost), so each path is
 * checked against the note's attached photos first; a path that is attached, or
 * that cannot be checked, is left alone — a leaked object is better than a
 * saved photo whose file is gone.
 */
export async function removeUnattachedNotePhotos(
  pending: readonly PendingNotePhoto[],
): Promise<void> {
  const byBike = new Map<string, PendingNotePhoto[]>();
  for (const photo of pending) {
    byBike.set(photo.motorcycleId, [...(byBike.get(photo.motorcycleId) ?? []), photo]);
  }
  await Promise.all(
    [...byBike].map(async ([motorcycleId, photos]) => {
      let attached: Set<string>;
      try {
        const { notes } = await gqlFetcher(NotesByMotorcycleDocument, { motorcycleId });
        attached = new Set(notes.flatMap((note) => note.photos.map((photo) => photo.storagePath)));
      } catch {
        return;
      }
      await Promise.all(
        photos
          .filter((photo) => !attached.has(photo.storagePath))
          .map((photo) => removeNotePhotoObject(photo.storagePath)),
      );
    }),
  );
}

/** What still needs the rider's eye after the note itself saved. */
interface PhotoProgress {
  done: number;
  total: number;
}

interface SavedState {
  noteId: string;
  motorcycleId: string;
  /** Local uris of new photos that are not attached yet. */
  failedPhotos: string[];
  /** Ids of photos the rider removed that are still attached. */
  failedRemovals: string[];
  taskMissing: boolean;
}

interface NoteFormProps {
  /** The bike the sheet was opened for. */
  bike: HubBike;
  /** Every bike of the rider — "Attach to" is hidden with a single bike. */
  bikes: readonly HubBike[];
  /** Set = edit mode. */
  note?: HubNote;
  draft?: string;
  /**
   * Turns true when the photo sheet should open (the composer's photo button):
   * the route sets it after the form sheet's presenting transition has ended.
   */
  openPhotoPicker?: boolean;
  onClose: () => void;
}

interface ChipProps {
  label: string;
  selected?: boolean;
  onPress: () => void;
  icon?: React.ReactNode;
  accessibilityLabel?: string;
  testID?: string;
}

function Chip({ label, selected = false, onPress, icon, accessibilityLabel, testID }: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerSelection();
        onPress();
      }}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected }}
      hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
      style={{
        height: HUB_HEIGHT.small,
        paddingHorizontal: 12,
        borderRadius: HUB_RADIUS.chip,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: selected ? hub.chipOnBorder : hub.hairlineStrong,
        backgroundColor: selected ? hub.chipOn : hub.ground,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
      }}
    >
      {icon}
      <Text
        style={{
          fontFamily: HUB_FONT.sansSemiBold,
          fontSize: 13,
          color: selected ? hub.text : hub.dim,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

/**
 * New / edit note: text, an odometer stamp, up to three photos, the bike it
 * belongs to and "also make it a task". Save is attached to the keyboard. The
 * note is saved first and photos after it, so a failed photo never loses the
 * note. Nothing here is gated.
 */
export function NoteForm({
  bike,
  bikes,
  note,
  draft,
  openPhotoPicker = false,
  onClose,
}: NoteFormProps) {
  const { t, i18n } = useTranslation();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const userId = useAuthStore((state) => state.session?.user?.id);
  const isEdit = !!note;
  const keyboardOpen = useKeyboardState((state) => state.isVisible);
  // The Save bar rides on the keyboard and covers the bottom of the scroll area;
  // its height (it grows with the error line) is added to the keyboard space so
  // the last row can always be scrolled clear of it.
  const [footerHeight, setFooterHeight] = useState(0);

  const [text, setText] = useState(note?.text ?? draft ?? '');
  const [targetId, setTargetId] = useState(bike.id);
  const [stampOn, setStampOn] = useState(isEdit ? note.odometer != null : true);
  const [alsoTask, setAlsoTask] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  /** Photo uploads of the save in progress; `null` while the note itself saves. */
  const [photoProgress, setPhotoProgress] = useState<PhotoProgress | null>(null);
  // State updates land a render later; two taps in the same frame both see
  // `saving === false`. The ref closes that window so a note is created once.
  const savingRef = useRef(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** New photos were added but there is no session to upload them under. */
  const [noSession, setNoSession] = useState(false);
  /** Set once the note itself is saved but something after it needs the rider's eye. */
  const [saved, setSaved] = useState<SavedState | null>(null);
  /**
   * Photos whose file is already in storage but whose `addNotePhoto` failed, by
   * local uri. A retry only re-sends `addNotePhoto` for the same object (no new
   * upload, no second orphan); objects still unattached when the sheet closes
   * are removed.
   */
  const uploadedPaths = useRef(new Map<string, PendingNotePhoto>());
  /**
   * The photo upload/attach run in progress, if any. The sheet can be dismissed
   * mid-save (Discard, swipe-down) while `addNotePhoto` is still in flight; the
   * unmount cleanup waits for it, so it never removes a file that is about to be
   * attached, and still collects uploads that finish after the sheet is gone.
   */
  const photosInFlight = useRef<Promise<unknown>>(Promise.resolve());
  // Cleanup runs on unmount, so it covers every way out — Cancel, Done and a
  // swipe-down of the sheet — exactly once.
  useEffect(() => {
    const pendingPhotos = uploadedPaths.current;
    const inFlight = photosInFlight;
    return () => {
      void inFlight.current.then(() => {
        const pending = [...pendingPhotos.values()];
        pendingPhotos.clear();
        if (pending.length > 0) return removeUnattachedNotePhotos(pending);
      });
    };
  }, []);

  // The bike the sheet was opened for comes first (and is preselected).
  const attachChoices = [bike, ...bikes.filter((candidate) => candidate.id !== bike.id)];
  const target = bikes.find((candidate) => candidate.id === targetId) ?? bike;
  const unit = toHubUnit(target.distanceUnit);
  // Edit keeps the note's own stamp; a new note stamps the target bike's odometer.
  const stampSource = isEdit ? (note.odometer ?? target.currentMileage) : target.currentMileage;
  // An unset odometer (null or 0) offers no stamp at all.
  const stampValue = hasOdometer(stampSource) ? stampSource : null;
  const keptPhotos = (note?.photos ?? []).filter((photo) => !removedPhotoIds.includes(photo.id));
  const photoCount = keptPhotos.length + newPhotos.length;
  const cleanText = normaliseNoteText(text);
  // The API's fallback title is the English 'Note'; a note with no words shows
  // the plain localised copy instead of naming it.
  const derivedTaskTitle = cleanText ? deriveTaskTitleFromNote(cleanText) : null;
  const initialStampOn = isEdit ? note.odometer != null : true;
  const dirty =
    text !== (note?.text ?? draft ?? '') ||
    newPhotos.length > 0 ||
    removedPhotoIds.length > 0 ||
    stampOn !== initialStampOn ||
    alsoTask;

  const addPhoto = () => {
    if (photoCount >= NOTE_PHOTOS_MAX) {
      Alert.alert(t('bikeHub.noteSheet.photoLimit', { max: NOTE_PHOTOS_MAX }));
      return;
    }
    const add = (uri: string | null) => {
      if (uri) setNewPhotos((current) => [...current, uri].slice(0, NOTE_PHOTOS_MAX));
    };
    showActionSheet(t('garage.addPhoto'), [
      { label: t('maintenance.takePhoto'), onPress: async () => add(await takePhoto()) },
      { label: t('maintenance.chooseFromLibrary'), onPress: async () => add(await pickImage()) },
      { label: t('common.cancel'), onPress: () => {}, style: 'cancel' },
    ]);
  };

  // The photo sheet is opened only once the caller says the form sheet has
  // finished presenting (`openPhotoPicker` turns true) — never on mount, when a
  // second native sheet would be asked for mid-transition.
  const pickerOpened = useRef(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: fires once, when the flag turns true
  useEffect(() => {
    if (!openPhotoPicker || pickerOpened.current) return;
    pickerOpened.current = true;
    addPhoto();
  }, [openPhotoPicker]);

  /** Uploads the given photos to the saved note; returns the ones that failed. */
  const uploadPhotos = async (
    noteId: string,
    motorcycleId: string,
    uris: readonly string[],
    owner: string,
  ): Promise<string[]> => {
    const run = uploadPhotosNow(noteId, motorcycleId, uris, owner);
    photosInFlight.current = run.catch(() => undefined);
    return run;
  };

  const uploadPhotosNow = async (
    noteId: string,
    motorcycleId: string,
    uris: readonly string[],
    owner: string,
  ): Promise<string[]> => {
    if (uris.length === 0) return [];
    let uploadedCount = 0;
    setPhotoProgress({ done: 0, total: uris.length });
    // The uploads are the slow part, so they run side by side; each settles on
    // its own, so one failure never holds the others back.
    const uploads = await Promise.allSettled(
      uris.map(async (uri) => {
        const uploaded = uploadedPaths.current.get(uri) ?? {
          ...(await uploadNotePhoto(uri, owner, noteId)),
          motorcycleId,
        };
        uploadedPaths.current.set(uri, uploaded);
        rememberLocalNotePhoto(uploaded.storagePath, uri);
        uploadedCount += 1;
        setPhotoProgress({ done: uploadedCount, total: uris.length });
        return uploaded;
      }),
    );
    // Attached one by one, in the order the rider added them.
    const failed: string[] = [];
    for (const [index, uri] of uris.entries()) {
      const upload = uploads[index];
      if (upload?.status !== 'fulfilled') {
        failed.push(uri);
        continue;
      }
      try {
        // Idempotent per storagePath on the server, so a retry after a lost
        // response returns the row the first call committed.
        await gqlFetcher(AddNotePhotoDocument, {
          input: {
            noteId,
            storagePath: upload.value.storagePath,
            fileSizeBytes: upload.value.fileSizeBytes,
          },
        });
        uploadedPaths.current.delete(uri);
      } catch (_error) {
        failed.push(uri);
      }
    }
    return failed;
  };

  /** Removes the given saved photos; returns the ids that could not be removed. */
  const removePhotos = async (photoIds: readonly string[]): Promise<string[]> => {
    const results = await Promise.allSettled(
      photoIds.map((photoId) => gqlFetcher(DeleteNotePhotoDocument, { photoId })),
    );
    return photoIds.filter((_id, index) => results[index]?.status === 'rejected');
  };

  /** Unattached uploads are cleaned up on unmount (see the effect above). */
  const close = () => onClose();

  const createNote = useCreateNote();
  const updateNote = useUpdateNote(bike.id);

  const finish = (next: SavedState) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notes.byMotorcycle(targetId) });
    if (next.failedPhotos.length === 0 && next.failedRemovals.length === 0 && !next.taskMissing) {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      close();
      return;
    }
    setSaved(next);
  };

  const save = async () => {
    if (!cleanText || savingRef.current) return;
    // Photos are stored under the rider's id: without a session they could
    // never upload (and Retry could never succeed), so say so before saving.
    if (newPhotos.length > 0 && !userId) {
      setNoSession(true);
      return;
    }
    savingRef.current = true;
    setSaving(true);
    setSaveFailed(false);
    setNoSession(false);
    const odometer = stampOn ? (stampValue ?? null) : null;
    const owner = userId ?? '';
    try {
      if (isEdit) {
        await updateNote.mutateAsync({ id: note.id, text: cleanText, odometer });
        const failedRemovals = await removePhotos(removedPhotoIds);
        finish({
          noteId: note.id,
          motorcycleId: note.motorcycleId,
          failedPhotos: await uploadPhotos(note.id, note.motorcycleId, newPhotos, owner),
          failedRemovals,
          taskMissing: false,
        });
        return;
      }
      const { createNote: created } = await createNote.mutateAsync({
        motorcycleId: targetId,
        text: cleanText,
        odometer,
        alsoCreateTask: alsoTask,
        source: NOTE_SOURCE.SHEET,
        hasPhoto: newPhotos.length > 0,
      });
      // The API keeps the note when the task could not be created; say so, do not fail.
      finish({
        noteId: created.id,
        motorcycleId: targetId,
        failedPhotos: await uploadPhotos(created.id, targetId, newPhotos, owner),
        failedRemovals: [],
        taskMissing: alsoTask && !created.linkedTaskId,
      });
    } catch (_error) {
      setSaveFailed(true);
    } finally {
      savingRef.current = false;
      setSaving(false);
      setPhotoProgress(null);
    }
  };

  const retryPhotos = async () => {
    if (!saved || savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    try {
      const failedRemovals = await removePhotos(saved.failedRemovals);
      const failedPhotos = await uploadPhotos(
        saved.noteId,
        saved.motorcycleId,
        saved.failedPhotos,
        userId ?? '',
      );
      finish({ ...saved, failedPhotos, failedRemovals });
    } finally {
      savingRef.current = false;
      setSaving(false);
      setPhotoProgress(null);
    }
  };

  const cancel = () => {
    if (!dirty || saved) return close();
    Alert.alert(t('bikeHub.noteSheet.discardTitle'), undefined, [
      { text: t('bikeHub.noteSheet.discardKeep'), style: 'cancel' },
      { text: t('bikeHub.noteSheet.discard'), style: 'destructive', onPress: close },
    ]);
  };

  /** The note saves first, then its photos upload — the button says which. */
  const saveLabel = (): string => {
    if (saved) return t('common.done');
    if (!saving) return t('bikeHub.noteSheet.save');
    if (photoProgress) return t('bikeHub.noteSheet.uploadingPhotos', { ...photoProgress });
    return t('bikeHub.noteSheet.saving');
  };

  const footerPadding = Math.max(insets.bottom, 16);
  // With the keyboard up the bar is pushed down by its own safe-area padding
  // (less a small gap), so only this much of it covers the scroll area. That
  // part — not the full measured height — is the extra scroll room, and the
  // focused field is kept just above it.
  const stickyOpenedOffset = footerPadding - FOOTER_KEYBOARD_GAP;
  const footerAboveKeyboard =
    footerHeight > 0 ? Math.max(0, footerHeight - stickyOpenedOffset) : FOOTER_FALLBACK_HEIGHT;

  return (
    <View style={{ flex: 1, backgroundColor: hub.card }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          paddingTop: 14,
          paddingBottom: 6,
          paddingHorizontal: 8,
        }}
      >
        <Pressable
          testID="note-cancel"
          onPress={cancel}
          accessibilityRole="button"
          style={{
            minHeight: HUB_TOUCH_TARGET,
            minWidth: 72,
            paddingHorizontal: 10,
            justifyContent: 'center',
          }}
        >
          <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.dim }}>
            {t('common.cancel')}
          </Text>
        </Pressable>
        <Text
          accessibilityRole="header"
          style={{
            flex: 1,
            textAlign: 'center',
            fontFamily: HUB_FONT.serif,
            fontSize: 24,
            color: hub.text,
          }}
        >
          {isEdit ? t('bikeHub.noteSheet.edit') : t('bikeHub.noteSheet.new')}
        </Text>
        <View style={{ width: 72 }} />
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        bottomOffset={footerAboveKeyboard + CARET_MARGIN}
        extraKeyboardSpace={footerAboveKeyboard}
        contentContainerStyle={{ gap: 12, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24 }}
      >
        <TextInput
          testID="note-text"
          value={text}
          onChangeText={(next) => {
            setText(next);
            setSaveFailed(false);
          }}
          multiline
          autoFocus={!isEdit}
          editable={!saved}
          maxLength={NOTE_TEXT_MAX}
          placeholder={t('bikeHub.noteSheet.placeholder')}
          placeholderTextColor={hub.muted}
          accessibilityLabel={t('bikeHub.log.note')}
          textAlignVertical="top"
          style={{
            minHeight: keyboardOpen ? MIN_INPUT_HEIGHT_TYPING : MIN_INPUT_HEIGHT,
            padding: INPUT_PADDING,
            borderRadius: HUB_RADIUS.button,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: hub.ripple,
            backgroundColor: hub.ground,
            color: hub.text,
            fontFamily: HUB_FONT.sans,
            fontSize: 16,
            lineHeight: INPUT_LINE_HEIGHT,
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 6 }}
        >
          {stampValue != null ? (
            <Chip
              testID="note-stamp"
              selected={stampOn}
              onPress={() => setStampOn((on) => !on)}
              icon={<Gauge size={14} color={stampOn ? hub.text : hub.dim} strokeWidth={2} />}
              label={
                isEdit
                  ? `${formatOdometer(stampValue, i18n.language)} ${unit}`
                  : t('bikeHub.noteSheet.stamp', {
                      odometer: formatOdometer(stampValue, i18n.language),
                      unit,
                    })
              }
              accessibilityLabel={t('bikeHub.noteSheet.stampA11y')}
            />
          ) : null}
          <Chip
            testID="note-add-photo"
            onPress={addPhoto}
            icon={<Camera size={14} color={hub.dim} strokeWidth={1.8} />}
            label={t('bikeHub.noteSheet.photo')}
          />
        </ScrollView>

        {photoCount > 0 ? (
          <View style={{ flexDirection: 'row', gap: 8 }}>
            {keptPhotos.map((photo) => (
              <Thumbnail
                key={photo.id}
                photo={{ storagePath: photo.storagePath, uri: photo.publicUrl }}
                removeLabel={t('bikeHub.noteSheet.removePhotoA11y')}
                onRemove={() => setRemovedPhotoIds((ids) => [...ids, photo.id])}
              />
            ))}
            {newPhotos.map((uri) => (
              <Thumbnail
                key={uri}
                photo={{ uri }}
                removeLabel={t('bikeHub.noteSheet.removePhotoA11y')}
                onRemove={() => setNewPhotos((uris) => uris.filter((other) => other !== uri))}
              />
            ))}
          </View>
        ) : null}

        {!isEdit && bikes.length > 1 ? (
          <View style={{ gap: 6 }}>
            <Text
              style={{
                fontFamily: HUB_FONT.mono,
                fontSize: 11,
                letterSpacing: 0.88,
                textTransform: 'uppercase',
                color: hub.muted,
                paddingHorizontal: 2,
              }}
            >
              {t('bikeHub.noteSheet.attachTo')}
            </Text>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
              contentContainerStyle={{ gap: 6 }}
            >
              {attachChoices.map((candidate) => (
                <Chip
                  key={candidate.id}
                  testID={`note-bike-${candidate.id}`}
                  selected={candidate.id === targetId}
                  onPress={() => setTargetId(candidate.id)}
                  label={bikeDisplayName(candidate)}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        {!isEdit ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 12,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderRadius: 12,
              borderCurve: 'continuous',
              backgroundColor: hub.ground,
              borderWidth: 1,
              borderColor: hub.hairline,
            }}
          >
            <View style={{ flex: 1, gap: 2 }}>
              <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.text }}>
                {t('bikeHub.noteSheet.alsoTask')}
              </Text>
              <Text
                testID="note-also-task-sub"
                style={{
                  fontFamily: HUB_FONT.sans,
                  fontSize: 12,
                  lineHeight: 16,
                  color: hub.muted,
                }}
              >
                {/* Names the task the server will create (same derivation as the API). */}
                {derivedTaskTitle && derivedTaskTitle !== NOTE_TASK_TITLE_FALLBACK
                  ? t('bikeHub.noteSheet.alsoTaskSubNamed', { title: derivedTaskTitle })
                  : t('bikeHub.noteSheet.alsoTaskSub')}
              </Text>
            </View>
            <View
              testID="note-also-task"
              accessible
              accessibilityRole="switch"
              accessibilityLabel={t('bikeHub.noteSheet.alsoTask')}
              accessibilityState={{ checked: alsoTask }}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => setAlsoTask((on) => !on)}
            >
              <NativeToggle value={alsoTask} onValueChange={setAlsoTask} tint={hub.copper} />
            </View>
          </View>
        ) : null}

        {saved ? (
          <View accessibilityLiveRegion="polite" style={{ gap: 6 }}>
            {saved.taskMissing ? (
              <Text
                style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 18, color: hub.dim }}
              >
                {t('bikeHub.noteSheet.taskNotCreated')}
              </Text>
            ) : null}
            {saved.failedPhotos.length > 0 || saved.failedRemovals.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text
                  testID="note-photo-error"
                  style={{ flex: 1, fontFamily: HUB_FONT.sans, fontSize: 13, color: hub.soon }}
                >
                  {saved.failedPhotos.length > 0
                    ? t('bikeHub.noteSheet.photoFailed')
                    : t('bikeHub.noteSheet.photoRemoveFailed')}
                </Text>
                <Pressable
                  testID="note-retry-photos"
                  onPress={retryPhotos}
                  accessibilityRole="button"
                  style={{
                    minHeight: HUB_TOUCH_TARGET,
                    justifyContent: 'center',
                    paddingHorizontal: 8,
                  }}
                >
                  <Text
                    style={{
                      fontFamily: HUB_FONT.sansSemiBold,
                      fontSize: 14,
                      color: hub.copperText,
                    }}
                  >
                    {t('common.retry')}
                  </Text>
                </Pressable>
              </View>
            ) : null}
          </View>
        ) : null}
      </KeyboardAwareScrollView>

      <KeyboardStickyView offset={{ closed: 0, opened: stickyOpenedOffset }}>
        <View
          testID="note-footer"
          onLayout={(event) => setFooterHeight(event.nativeEvent.layout.height)}
          style={{
            paddingTop: 12,
            paddingHorizontal: 16,
            paddingBottom: footerPadding,
            borderTopWidth: 1,
            borderTopColor: hub.hairline,
            backgroundColor: hub.card,
          }}
        >
          {/* In the keyboard-attached footer, right above the button it explains:
              inside the scroll area it sat below the fold with the keyboard open. */}
          {saveFailed || noSession ? (
            <Text
              testID="note-save-error"
              accessibilityLiveRegion="polite"
              style={{ fontFamily: HUB_FONT.sans, fontSize: 13, color: hub.late, marginBottom: 8 }}
            >
              {noSession ? t('bikeHub.noteSheet.photoNeedsSignIn') : t('bikeHub.notes.saveFailed')}
            </Text>
          ) : null}
          <Pressable
            testID="note-save"
            onPress={saved ? close : save}
            disabled={!saved && (!cleanText || saving)}
            accessibilityRole="button"
            accessibilityState={{ disabled: !saved && !cleanText, busy: saving }}
            style={({ pressed }) => ({
              height: HUB_HEIGHT.primary,
              borderRadius: HUB_RADIUS.button,
              borderCurve: 'continuous',
              backgroundColor: hub.copper,
              alignItems: 'center',
              justifyContent: 'center',
              // Busy keeps full strength: the spinner and label carry the state.
              opacity: !saved && !cleanText ? 0.4 : pressed && !saving ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {saving ? <ActivityIndicator size="small" color={hub.ink} /> : null}
              <Text
                testID="note-save-label"
                style={{
                  fontFamily: HUB_FONT.sansBold,
                  fontSize: 16,
                  color: hub.ink,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {saveLabel()}
              </Text>
            </View>
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Thumbnail({
  photo,
  onRemove,
  removeLabel,
}: {
  photo: { storagePath?: string; uri: string };
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <View style={{ width: THUMBNAIL, height: THUMBNAIL }}>
      <NotePhoto photo={photo} size={THUMBNAIL} />
      <Pressable
        onPress={() => {
          triggerImpact();
          onRemove();
        }}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        hitSlop={12}
        style={{
          position: 'absolute',
          top: -6,
          right: -6,
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: hub.raised,
          borderWidth: 1,
          borderColor: hub.hairlineStrong,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <X size={14} color={hub.text} strokeWidth={2.5} />
      </Pressable>
    </View>
  );
}
