import { AddNotePhotoDocument, DeleteNotePhotoDocument } from '@motovault/graphql';
import { NOTE_PHOTOS_MAX, NOTE_TEXT_MAX } from '@motovault/types';
import { useQueryClient } from '@tanstack/react-query';
import * as Haptics from 'expo-haptics';
import { Image } from 'expo-image';
import { Camera, Gauge, X } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import { KeyboardAwareScrollView, KeyboardStickyView } from 'react-native-keyboard-controller';
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
import { showActionSheet } from '../../../utils/action-sheet';
import { triggerImpact, triggerNotification, triggerSelection } from '../../../utils/haptics';
import { NativeToggle } from '../../ui/native-toggle';
import { type HubNote, useCreateNote, useUpdateNote } from '../notes/use-notes';
import type { HubBike } from '../shell/use-bike-hub-data';
import { HUB_FONT, HUB_HEIGHT, HUB_RADIUS, HUB_TOUCH_TARGET, hub } from '../ui/tokens';

const CHIP_SLOP = Math.ceil((HUB_TOUCH_TARGET - HUB_HEIGHT.small) / 2);
const THUMBNAIL = 64;
const MIN_INPUT_HEIGHT = 6 * 23 + 28;

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

  const [text, setText] = useState(note?.text ?? draft ?? '');
  const [targetId, setTargetId] = useState(bike.id);
  const [stampOn, setStampOn] = useState(isEdit ? note.odometer != null : true);
  const [alsoTask, setAlsoTask] = useState(false);
  const [newPhotos, setNewPhotos] = useState<string[]>([]);
  const [removedPhotoIds, setRemovedPhotoIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [saveFailed, setSaveFailed] = useState(false);
  /** Set once the note itself is saved but something after it needs the rider's eye. */
  const [saved, setSaved] = useState<{
    noteId: string;
    failedPhotos: string[];
    taskMissing: boolean;
  } | null>(null);

  const target = bikes.find((candidate) => candidate.id === targetId) ?? bike;
  const unit = toHubUnit(target.distanceUnit);
  // Edit keeps the note's own stamp; a new note stamps the target bike's odometer.
  const stampSource = isEdit ? (note.odometer ?? target.currentMileage) : target.currentMileage;
  // An unset odometer (null or 0) offers no stamp at all.
  const stampValue = hasOdometer(stampSource) ? stampSource : null;
  const keptPhotos = (note?.photos ?? []).filter((photo) => !removedPhotoIds.includes(photo.id));
  const photoCount = keptPhotos.length + newPhotos.length;
  const cleanText = normaliseNoteText(text);
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
  const uploadPhotos = async (noteId: string, uris: readonly string[]): Promise<string[]> => {
    if (!userId) return [...uris];
    const failed: string[] = [];
    for (const uri of uris) {
      try {
        const { storagePath, fileSizeBytes } = await uploadNotePhoto(uri, userId, noteId);
        await gqlFetcher(AddNotePhotoDocument, { input: { noteId, storagePath, fileSizeBytes } });
      } catch (_error) {
        failed.push(uri);
      }
    }
    return failed;
  };

  const createNote = useCreateNote();
  const updateNote = useUpdateNote(bike.id);

  const finish = (noteId: string, failedPhotos: string[], taskMissing: boolean) => {
    queryClient.invalidateQueries({ queryKey: queryKeys.notes.byMotorcycle(targetId) });
    if (failedPhotos.length === 0 && !taskMissing) {
      triggerNotification(Haptics.NotificationFeedbackType.Success);
      onClose();
      return;
    }
    setSaved({ noteId, failedPhotos, taskMissing });
  };

  const save = async () => {
    if (!cleanText || saving) return;
    setSaving(true);
    setSaveFailed(false);
    const odometer = stampOn ? (stampValue ?? null) : null;
    try {
      if (isEdit) {
        await updateNote.mutateAsync({ id: note.id, text: cleanText, odometer });
        await Promise.allSettled(
          removedPhotoIds.map((photoId) => gqlFetcher(DeleteNotePhotoDocument, { photoId })),
        );
        finish(note.id, await uploadPhotos(note.id, newPhotos), false);
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
      finish(
        created.id,
        await uploadPhotos(created.id, newPhotos),
        alsoTask && !created.linkedTaskId,
      );
    } catch (_error) {
      setSaveFailed(true);
    } finally {
      setSaving(false);
    }
  };

  const retryPhotos = async () => {
    if (!saved || saving) return;
    setSaving(true);
    const failedPhotos = await uploadPhotos(saved.noteId, saved.failedPhotos);
    setSaving(false);
    finish(saved.noteId, failedPhotos, saved.taskMissing);
  };

  const cancel = () => {
    if (!dirty || saved) return onClose();
    Alert.alert(t('bikeHub.noteSheet.discardTitle'), undefined, [
      { text: t('bikeHub.noteSheet.discardKeep'), style: 'cancel' },
      { text: t('bikeHub.noteSheet.discard'), style: 'destructive', onPress: onClose },
    ]);
  };

  const footerPadding = Math.max(insets.bottom, 16);

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
        bottomOffset={HUB_HEIGHT.primary + 32}
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
            minHeight: MIN_INPUT_HEIGHT,
            padding: 14,
            borderRadius: HUB_RADIUS.button,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: hub.ripple,
            backgroundColor: hub.ground,
            color: hub.text,
            fontFamily: HUB_FONT.sans,
            fontSize: 16,
            lineHeight: 23,
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
                uri={photo.publicUrl}
                removeLabel={t('bikeHub.noteSheet.removePhotoA11y')}
                onRemove={() => setRemovedPhotoIds((ids) => [...ids, photo.id])}
              />
            ))}
            {newPhotos.map((uri) => (
              <Thumbnail
                key={uri}
                uri={uri}
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
              {bikes.map((candidate) => (
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
                style={{
                  fontFamily: HUB_FONT.sans,
                  fontSize: 12,
                  lineHeight: 16,
                  color: hub.muted,
                }}
              >
                {t('bikeHub.noteSheet.alsoTaskSub')}
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
            {saved.failedPhotos.length > 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                <Text style={{ flex: 1, fontFamily: HUB_FONT.sans, fontSize: 13, color: hub.soon }}>
                  {t('bikeHub.noteSheet.photoFailed')}
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

      <KeyboardStickyView offset={{ closed: 0, opened: footerPadding - 12 }}>
        <View
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
          {saveFailed ? (
            <Text
              testID="note-save-error"
              accessibilityLiveRegion="polite"
              style={{ fontFamily: HUB_FONT.sans, fontSize: 13, color: hub.late, marginBottom: 8 }}
            >
              {t('bikeHub.notes.saveFailed')}
            </Text>
          ) : null}
          <Pressable
            testID="note-save"
            onPress={saved ? onClose : save}
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
              opacity: !saved && (!cleanText || saving) ? 0.4 : pressed ? 0.85 : 1,
            })}
          >
            <Text style={{ fontFamily: HUB_FONT.sansBold, fontSize: 16, color: hub.ink }}>
              {saved ? t('common.done') : t('bikeHub.noteSheet.save')}
            </Text>
          </Pressable>
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function Thumbnail({
  uri,
  onRemove,
  removeLabel,
}: {
  uri: string;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <View style={{ width: THUMBNAIL, height: THUMBNAIL }}>
      <Image
        source={{ uri }}
        style={{ width: THUMBNAIL, height: THUMBNAIL, borderRadius: 10 }}
        contentFit="cover"
      />
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
