import { AddNotePhotoDocument, DeleteNotePhotoDocument } from '@motovault/graphql';
import {
  deriveTaskTitleFromNote,
  NOTE_PHOTOS_MAX,
  NOTE_TASK_TITLE_FALLBACK,
  NOTE_TEXT_MAX,
} from '@motovault/types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Check, CircleAlert, Gauge, ImagePlus, X } from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
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
import { pickImage, takePhoto, uploadNotePhoto } from '../../../lib/image-upload';
import { queryKeys } from '../../../lib/query-keys';
import { useAuthStore } from '../../../stores/auth.store';
import { type ParkedPhotoUpload, parkedPhotoPaths } from '../../../stores/sheet-draft.store';
import { showActionSheet } from '../../../utils/action-sheet';
import { triggerImpact, triggerNotification, triggerSelection } from '../../../utils/haptics';
import { NativeToggle } from '../../ui/native-toggle';
import { NotePhoto, rememberLocalNotePhoto } from '../notes/note-photo';
import { removeUnattachedNotePhotos } from '../notes/unattached-note-photos';
import { DRAFT_OUTCOME } from '../notes/use-draft-handoff';
import { type HubNote, useCreateNote, useUpdateNote } from '../notes/use-notes';
import type { HubBike } from '../shell/use-bike-hub-data';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FONT,
  HUB_HEIGHT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  hub,
} from '../ui/tokens';
import { DraftRestoredNotice } from './draft-restored-notice';
import { SHEET_CANCEL_PLACEMENT, SHEET_LOCKED_OPACITY, SheetHeader } from './sheet-header';
import { parkUnattachedPhotos, useNoteDraft, useRestoredNoteDraft } from './use-note-draft';
import { useSheetDiscardGuard } from './use-sheet-discard-guard';

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
/** Controls that cannot be used while the note saves (or after it saved) are dimmed to this. */
const LOCKED_OPACITY = SHEET_LOCKED_OPACITY;

/** An uploaded object whose `addNotePhoto` has not been confirmed. */
export type PendingNotePhoto = ParkedPhotoUpload;

/** Photos of the save in progress: how many are attached to the note so far. */
interface PhotoProgress {
  attached: number;
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
  /**
   * Leaves the sheet with ONE navigation action (the route's `router.back()`).
   * While there is unsaved work the form's own remove guard intercepts it and
   * asks first, exactly as it does for a swipe-down or system Back.
   */
  onClose: () => void;
}

interface ChipProps {
  label: string;
  selected?: boolean;
  disabled?: boolean;
  onPress: () => void;
  icon?: ReactNode;
  /** Geist Mono label (an odometer stamp: every number is mono). */
  mono?: boolean;
  accessibilityLabel?: string;
  testID?: string;
}

/** A choice chip: selected = chip-on fill + copper border, as DESIGN.md's sheet chips. */
function Chip({
  label,
  selected = false,
  disabled = false,
  onPress,
  icon,
  mono = false,
  accessibilityLabel,
  testID,
}: ChipProps) {
  return (
    <Pressable
      testID={testID}
      onPress={() => {
        triggerSelection();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? label}
      accessibilityState={{ selected, disabled }}
      hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
      style={{
        minHeight: HUB_HEIGHT.small,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: HUB_RADIUS.chip,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: selected ? hub.chipOnBorder : hub.hairlineStrong,
        backgroundColor: selected ? hub.chipOn : hub.ground,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? LOCKED_OPACITY : 1,
      }}
    >
      {icon}
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        numberOfLines={1}
        style={{
          fontFamily: mono ? HUB_FONT.monoMedium : HUB_FONT.sansSemiBold,
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
 * "Add photo": an action, not a toggle, so it never wears the toggle chip's
 * look — the dashed outline is the hub's "add a photo" vocabulary (DESIGN.md).
 */
function AddPhotoChip({
  label,
  disabled,
  onPress,
}: {
  label: string;
  disabled: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      testID="note-add-photo"
      onPress={() => {
        triggerImpact();
        onPress();
      }}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      hitSlop={{ top: CHIP_SLOP, bottom: CHIP_SLOP }}
      style={({ pressed }) => ({
        minHeight: HUB_HEIGHT.small,
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: HUB_RADIUS.chip,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderStyle: 'dashed',
        borderColor: hub.dashed,
        // The sheet's own surface: the dashed outline alone marks it as an action.
        backgroundColor: pressed ? hub.raised : hub.card,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        opacity: disabled ? LOCKED_OPACITY : 1,
      })}
    >
      <ImagePlus size={14} color={hub.text} strokeWidth={1.8} />
      <Text
        maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
        numberOfLines={1}
        style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 13, color: hub.text }}
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
 *
 * Work left behind by a dismissal nobody could ask about (an Android drag-down)
 * is parked in the sheet-draft store and restored the next time the sheet opens
 * for the same bike (new note) or note (edit), under a quiet "Restored …" line
 * with Clear. A quick-add hand-off wins over a parked draft unless the draft
 * grew from that same hand-off (`restorableNoteDraft`).
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

  const { key: draftKey, restored: parkedDraft } = useRestoredNoteDraft({
    bikeId: bike.id,
    bikeIds: bikes.map((candidate) => candidate.id),
    noteId: note?.id,
    draft,
  });
  const restored = parkedDraft?.draft;
  // A photos-only draft carries no words of its own: the note's current text
  // and stamp stand, so restoring it never reverts text saved after it parked.
  const restoredWords = restored?.photosOnly ? undefined : restored;
  const [showRestored, setShowRestored] = useState(parkedDraft !== null);
  const initialText = note?.text ?? draft ?? '';
  const initialStampOn = isEdit ? note.odometer != null : true;

  const [text, setText] = useState(restoredWords?.text ?? initialText);
  const [targetId, setTargetId] = useState(restored?.targetId ?? bike.id);
  const [stampOn, setStampOn] = useState(restoredWords?.stampOn ?? initialStampOn);
  const [alsoTask, setAlsoTask] = useState(restored?.alsoTask ?? false);
  const [newPhotos, setNewPhotos] = useState<string[]>(restored?.newPhotos ?? []);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>(restored?.removedPhotoIds ?? []);
  const [saving, setSaving] = useState(false);
  /** Photo attaches of the save in progress; `null` while the note itself saves. */
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
   * local uri — seeded from a restored draft that carried them. A retry only
   * re-sends `addNotePhoto` for the same object (no new upload, no second
   * orphan); objects still unattached when the sheet is done are removed
   * (`releaseUnattached`), unless a parked draft carries them.
   */
  const uploadedPaths = useRef<Map<string, PendingNotePhoto> | null>(null);
  uploadedPaths.current ??= new Map(Object.entries(restored?.uploaded ?? {}));
  const storedPhotos = uploadedPaths.current;
  /**
   * Removes every uploaded object that never attached and is not carried by a
   * parked draft (that draft re-attaches it), and forgets them all.
   */
  const releaseUnattached = () => {
    const carried = parkedPhotoPaths();
    const orphans = [...storedPhotos.values()].filter((photo) => !carried.has(photo.storagePath));
    storedPhotos.clear();
    if (orphans.length > 0) void removeUnattachedNotePhotos(orphans);
  };
  // On unmount — Cancel, Done or a swipe-down — exactly once. Deferred a tick so
  // the draft the sheet parks on leaving is in the store first. A save still in
  // flight is left to settle it: once it ends with the sheet gone, it parks what
  // did not attach and releases the rest itself (`finish`).
  // biome-ignore lint/correctness/useExhaustiveDependencies: runs once, on unmount
  useEffect(
    () => () => {
      if (savingRef.current) return;
      void Promise.resolve().then(releaseUnattached);
    },
    [],
  );

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
  const dirty =
    text !== initialText ||
    newPhotos.length > 0 ||
    removedPhotoIds.length > 0 ||
    stampOn !== initialStampOn ||
    alsoTask;
  /**
   * While the note saves, and once it is on the server, the form is read-only:
   * an edit made then would silently not be part of the note.
   */
  const locked = saving || !!saved;

  /**
   * The one unsaved-work guard for every way out: Cancel (`onClose` →
   * `router.back()`), the iOS swipe-down and the system Back. It stays on for
   * every save in flight — the first save AND a Retry after the note is on the
   * server — so the sheet cannot be left half-way through attaching photos.
   */
  const guard = useSheetDiscardGuard({
    unsaved: !saved && dirty,
    saving,
    confirmDiscard: (discard) =>
      Alert.alert(t('bikeHub.noteSheet.discardTitle'), t('bikeHub.noteSheet.discardMessage'), [
        { text: t('bikeHub.noteSheet.discardKeep'), style: 'cancel' },
        { text: t('bikeHub.noteSheet.discard'), style: 'destructive', onPress: discard },
      ]),
  });

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
    if (uris.length === 0) return [];
    // Progress counts photos ATTACHED to the note, never mere uploads: the label
    // must not read "2 of 2" while the last one is still being attached.
    let attachedCount = 0;
    setPhotoProgress({ attached: 0, total: uris.length });
    // The uploads are the slow part, so they run side by side; each settles on
    // its own, so one failure never holds the others back.
    const uploads = await Promise.allSettled(
      uris.map(async (uri) => {
        const uploaded = storedPhotos.get(uri) ?? {
          ...(await uploadNotePhoto(uri, owner, noteId)),
          motorcycleId,
        };
        storedPhotos.set(uri, uploaded);
        rememberLocalNotePhoto(uploaded.storagePath, uri);
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
        storedPhotos.delete(uri);
        attachedCount += 1;
        setPhotoProgress({ attached: attachedCount, total: uris.length });
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

  /** The uploaded-but-unattached objects of these photos, by local uri. */
  const uploadedOf = (uris: readonly string[]): Record<string, ParkedPhotoUpload> =>
    Object.fromEntries(
      uris.flatMap((uri) => {
        const upload = storedPhotos.get(uri);
        return upload ? [[uri, upload]] : [];
      }),
    );
  /**
   * Unsaved work a dismissal now would lose: typed, not saved, and no save in
   * flight. A save in flight is not parked — a sheet reopened meanwhile must not
   * restore work that may already be on the server; it is parked only if it
   * fails (`saveFailedAfterLeaving`). Once the note is on the server (`saved`)
   * nothing is parked — a Retry only re-attaches photos.
   */
  const pendingWork = () => !saved && !savingRef.current && dirty;
  const noteDraft = useNoteDraft({
    key: draftKey,
    restored: parkedDraft,
    isEdit,
    draft,
    exit: guard.exit,
    pending: pendingWork,
    saving: () => savingRef.current,
    snapshot: () => ({
      text,
      stampOn,
      alsoTask,
      targetId,
      newPhotos,
      removedPhotoIds,
      uploaded: uploadedOf(newPhotos),
      // An edit that left the words alone parks as photos-only: restored, it
      // starts from the note's text as it is then, not as it was now.
      photosOnly: isEdit && text === initialText && stampOn === initialStampOn,
    }),
  });

  /** "Clear" on the restored line: back to how the sheet would have opened. */
  const clearRestored = () => {
    noteDraft.dropRestored();
    setText(initialText);
    setTargetId(bike.id);
    setStampOn(initialStampOn);
    setAlsoTask(false);
    setNewPhotos([]);
    setRemovedPhotoIds([]);
    setSaveFailed(false);
    setNoSession(false);
    setShowRestored(false);
  };

  const finish = (next: SavedState) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notes.byMotorcycle(next.motorcycleId) });
    // Dismissed while saving (an Android drag-down cannot be held back): the
    // note is saved, but the sheet is gone — `close()` would pop the screen
    // that is now on top. Photos that did not go through are parked against
    // the saved note, so opening it again offers them (there is no Retry left).
    if (!guard.isMounted()) {
      parkUnattachedPhotos({
        noteId: next.noteId,
        motorcycleId: next.motorcycleId,
        text: cleanText ?? text,
        stampOn: stampOn && stampValue != null,
        photos: next.failedPhotos,
        uploaded: uploadedOf(next.failedPhotos),
        removals: next.failedRemovals,
      });
      // The unmount cleanup left this to the save: the parked photos keep their
      // objects, anything else uploaded and never attached is removed.
      releaseUnattached();
      return;
    }
    if (next.failedPhotos.length === 0 && next.failedRemovals.length === 0 && !next.taskMissing) {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      guard.leaveAfterSave(close);
      return;
    }
    triggerNotification(Haptics.NotificationFeedbackType.Warning);
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
        noteDraft.clearOwned();
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
        text: cleanText ?? text,
        odometer,
        alsoCreateTask: alsoTask,
        source: NOTE_SOURCE.SHEET,
        hasPhoto: newPhotos.length > 0,
      });
      // The note exists (on this bike or another): the handed-off draft is saved,
      // and so is any parked draft — also when the sheet was dismissed mid-save.
      noteDraft.settle(DRAFT_OUTCOME.SAVED);
      noteDraft.clearOwned();
      // The API keeps the note when the task could not be created; say so, do not fail.
      finish({
        noteId: created.id,
        motorcycleId: targetId,
        failedPhotos: await uploadPhotos(created.id, targetId, newPhotos, owner),
        failedRemovals: [],
        taskMissing: alsoTask && !created.linkedTaskId,
      });
    } catch (_error) {
      // Dismissed mid-save and the note was not saved: park the work now (the
      // hand-off stays pending — the restored draft, saved later, still clears
      // the field that handed it off).
      if (!guard.isMounted()) {
        noteDraft.saveFailedAfterLeaving();
        releaseUnattached();
      }
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

  const failedPhotoCount = saved ? saved.failedPhotos.length + saved.failedRemovals.length : 0;
  const retryable = failedPhotoCount > 0;

  /** What the primary button says: the note saves first, then its photos attach. */
  const primaryLabel = (): string => {
    if (saving && photoProgress) {
      return t('bikeHub.noteSheet.addingPhotos', {
        done: photoProgress.attached,
        total: photoProgress.total,
      });
    }
    if (saving) return t('bikeHub.noteSheet.saving');
    if (retryable) return t('bikeHub.noteSheet.retryPhotos', { count: failedPhotoCount });
    if (saved) return t('common.done');
    return t('bikeHub.noteSheet.save');
  };
  // After a partial failure Retry is the primary action and Done the secondary.
  const onPrimary = retryable ? retryPhotos : saved ? close : save;
  const primaryDisabled = saving || (!saved && !cleanText);
  // Nothing to save yet: a neutral raised button with dim text, not faded copper.
  const primaryInert = !saving && !saved && !cleanText;

  const footerPadding = Math.max(insets.bottom, 16);
  // With the keyboard up the bar is pushed down by its own safe-area padding
  // (less a small gap), so only this much of it covers the scroll area. That
  // part — not the full measured height — is the extra scroll room, and the
  // focused field is kept just above it.
  const stickyOpenedOffset = footerPadding - FOOTER_KEYBOARD_GAP;
  const footerAboveKeyboard =
    footerHeight > 0 ? Math.max(0, footerHeight - stickyOpenedOffset) : FOOTER_FALLBACK_HEIGHT;

  const stampOdometer = stampValue != null ? formatOdometer(stampValue, i18n.language) : '';
  const stampLabel = (): string => {
    if (!stampOn) return t('bikeHub.noteSheet.stampOff');
    if (isEdit) return `${stampOdometer} ${unit}`;
    return t('bikeHub.noteSheet.stamp', { odometer: stampOdometer, unit });
  };
  const failedUris = new Set(saved?.failedPhotos ?? []);

  return (
    <View style={{ flex: 1, backgroundColor: hub.card }}>
      <View style={{ paddingTop: 14, paddingBottom: 6, paddingHorizontal: 12 }}>
        <SheetHeader
          title={isEdit ? t('bikeHub.noteSheet.edit') : t('bikeHub.noteSheet.new')}
          // One back action; the remove guard above asks first when there is unsaved work.
          onCancel={close}
          cancelPlacement={SHEET_CANCEL_PLACEMENT.LEADING}
          // A save in flight cannot be discarded (the note may already be on the
          // server); Cancel waits for it. Once saved, Cancel simply closes.
          cancelDisabled={saving}
          cancelTestID="note-cancel"
        />
      </View>

      <KeyboardAwareScrollView
        keyboardShouldPersistTaps="handled"
        bottomOffset={footerAboveKeyboard + CARET_MARGIN}
        extraKeyboardSpace={footerAboveKeyboard}
        contentContainerStyle={{ gap: 12, paddingTop: 6, paddingHorizontal: 16, paddingBottom: 24 }}
      >
        {showRestored ? (
          <DraftRestoredNotice
            testID="note-restored"
            message={t('bikeHub.sheetDraft.noteRestored')}
            clearAccessibilityLabel={t('bikeHub.sheetDraft.clearNoteA11y')}
            onClear={clearRestored}
            disabled={locked}
          />
        ) : null}
        <TextInput
          keyboardAppearance="dark"
          selectionColor={hub.copper}
          testID="note-text"
          value={text}
          onChangeText={(next) => {
            setText(next);
            setSaveFailed(false);
          }}
          multiline
          autoFocus={!isEdit}
          editable={!locked}
          maxLength={NOTE_TEXT_MAX}
          placeholder={t('bikeHub.noteSheet.placeholder')}
          placeholderTextColor={hub.muted}
          accessibilityLabel={t('bikeHub.log.note')}
          accessibilityState={{ disabled: locked }}
          textAlignVertical="top"
          style={{
            minHeight: keyboardOpen ? MIN_INPUT_HEIGHT_TYPING : MIN_INPUT_HEIGHT,
            padding: INPUT_PADDING,
            borderRadius: HUB_RADIUS.button,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: hub.ripple,
            backgroundColor: hub.ground,
            color: locked ? hub.dim : hub.text,
            fontFamily: HUB_FONT.sans,
            fontSize: 16,
            lineHeight: INPUT_LINE_HEIGHT,
          }}
        />

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{ gap: 6, alignItems: 'center' }}
        >
          {stampValue != null ? (
            <Chip
              testID="note-stamp"
              selected={stampOn}
              disabled={locked}
              mono={stampOn}
              onPress={() => setStampOn((on) => !on)}
              // The icon changes with the state, so on/off reads without colour.
              icon={
                stampOn ? (
                  <Check size={14} color={hub.text} strokeWidth={2.5} />
                ) : (
                  <Gauge size={14} color={hub.dim} strokeWidth={2} />
                )
              }
              label={stampLabel()}
              accessibilityLabel={t(
                stampOn ? 'bikeHub.noteSheet.stampA11yOn' : 'bikeHub.noteSheet.stampA11yOff',
                { odometer: stampOdometer, unit },
              )}
            />
          ) : null}
          <AddPhotoChip
            label={t('bikeHub.noteSheet.addPhoto')}
            disabled={locked}
            onPress={addPhoto}
          />
        </ScrollView>

        {photoCount > 0 ? (
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, paddingTop: 6 }}>
            {keptPhotos.map((photo) => (
              <Thumbnail
                key={photo.id}
                photo={{ storagePath: photo.storagePath, uri: photo.publicUrl }}
                removeLabel={t('bikeHub.noteSheet.removePhotoA11y')}
                disabled={locked}
                onRemove={() => setRemovedPhotoIds((ids) => [...ids, photo.id])}
              />
            ))}
            {newPhotos.map((uri) => (
              <Thumbnail
                key={uri}
                photo={{ uri }}
                removeLabel={t('bikeHub.noteSheet.removePhotoA11y')}
                failedLabel={
                  failedUris.has(uri) ? t('bikeHub.noteSheet.photoNotAddedA11y') : undefined
                }
                disabled={locked}
                onRemove={() => setNewPhotos((uris) => uris.filter((other) => other !== uri))}
              />
            ))}
          </View>
        ) : null}

        {!isEdit && bikes.length > 1 ? (
          <View style={{ gap: 6 }}>
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
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
                  disabled={locked}
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
              opacity: locked ? LOCKED_OPACITY : 1,
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
              accessibilityState={{ checked: alsoTask, disabled: locked }}
              accessibilityActions={[{ name: 'activate' }]}
              onAccessibilityAction={() => {
                if (!locked) setAlsoTask((on) => !on);
              }}
            >
              {/* The sheet is dark in both schemes: the off track must read on it. */}
              <NativeToggle
                value={alsoTask}
                onValueChange={setAlsoTask}
                tint={hub.copper}
                disabled={locked}
                darkSurface
                offTrack={hub.track}
              />
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
            {retryable ? (
              <View testID="note-photo-error" style={{ gap: 4 }}>
                {saved.failedPhotos.length > 0 ? (
                  <Text
                    style={{
                      fontFamily: HUB_FONT.sans,
                      fontSize: 13,
                      lineHeight: 18,
                      color: hub.late,
                    }}
                  >
                    {t('bikeHub.noteSheet.photosNotAdded', { count: saved.failedPhotos.length })}
                  </Text>
                ) : null}
                {saved.failedRemovals.length > 0 ? (
                  <Text
                    style={{
                      fontFamily: HUB_FONT.sans,
                      fontSize: 13,
                      lineHeight: 18,
                      color: hub.late,
                    }}
                  >
                    {t('bikeHub.noteSheet.photosNotRemoved', {
                      count: saved.failedRemovals.length,
                    })}
                  </Text>
                ) : null}
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
            gap: 8,
          }}
        >
          {/* In the keyboard-attached footer, right above the button it explains:
              inside the scroll area it sat below the fold with the keyboard open. */}
          {saveFailed || noSession ? (
            <Text
              testID="note-save-error"
              accessibilityLiveRegion="polite"
              style={{ fontFamily: HUB_FONT.sans, fontSize: 13, lineHeight: 18, color: hub.late }}
            >
              {noSession ? t('bikeHub.noteSheet.photoNeedsSignIn') : t('bikeHub.notes.saveFailed')}
            </Text>
          ) : null}
          <Pressable
            testID="note-save"
            onPress={onPrimary}
            disabled={primaryDisabled}
            accessibilityRole="button"
            accessibilityState={{ disabled: primaryDisabled, busy: saving }}
            style={({ pressed }) => ({
              minHeight: HUB_HEIGHT.primary,
              paddingVertical: 10,
              paddingHorizontal: 16,
              borderRadius: HUB_RADIUS.button,
              borderCurve: 'continuous',
              backgroundColor: primaryInert ? hub.raised : hub.copper,
              alignItems: 'center',
              justifyContent: 'center',
              // Busy keeps full strength: the spinner and label carry the state.
              opacity: pressed && !primaryDisabled ? 0.85 : 1,
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              {saving ? <ActivityIndicator size="small" color={hub.ink} /> : null}
              <Text
                testID="note-save-label"
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                numberOfLines={2}
                style={{
                  flexShrink: 1,
                  textAlign: 'center',
                  fontFamily: HUB_FONT.sansBold,
                  fontSize: 16,
                  color: primaryInert ? hub.muted : hub.ink,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {primaryLabel()}
              </Text>
            </View>
          </Pressable>
          {retryable ? (
            <Pressable
              testID="note-done"
              onPress={close}
              disabled={saving}
              accessibilityRole="button"
              accessibilityState={{ disabled: saving }}
              style={({ pressed }) => ({
                minHeight: HUB_HEIGHT.secondary,
                paddingVertical: 8,
                borderRadius: HUB_RADIUS.button,
                borderCurve: 'continuous',
                backgroundColor: hub.raised,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: saving ? LOCKED_OPACITY : pressed ? 0.85 : 1,
              })}
            >
              <Text
                maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
                style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.text }}
              >
                {t('common.done')}
              </Text>
            </Pressable>
          ) : null}
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Thumbnail({
  photo,
  onRemove,
  removeLabel,
  failedLabel,
  disabled,
}: {
  photo: { storagePath?: string; uri: string };
  onRemove: () => void;
  removeLabel: string;
  /** Set = this photo was not attached; it is outlined and badged in the error colour. */
  failedLabel?: string;
  disabled: boolean;
}) {
  return (
    <View
      testID={failedLabel ? 'note-photo-failed' : undefined}
      style={{ width: THUMBNAIL, height: THUMBNAIL }}
    >
      <NotePhoto photo={photo} size={THUMBNAIL} accessibilityLabel={failedLabel} />
      {failedLabel ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            borderRadius: HUB_RADIUS.tile,
            borderCurve: 'continuous',
            borderWidth: 2,
            borderColor: hub.late,
            alignItems: 'flex-start',
            justifyContent: 'flex-end',
            padding: 4,
          }}
        >
          <View
            style={{
              width: 20,
              height: 20,
              borderRadius: 10,
              backgroundColor: hub.photoChip,
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <CircleAlert size={14} color={hub.late} strokeWidth={2.5} />
          </View>
        </View>
      ) : null}
      <Pressable
        onPress={() => {
          triggerImpact();
          onRemove();
        }}
        disabled={disabled}
        accessibilityRole="button"
        accessibilityLabel={removeLabel}
        accessibilityState={{ disabled }}
        hitSlop={12}
        style={{
          opacity: disabled ? LOCKED_OPACITY : 1,
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
