import { Pencil, Trash2 } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, type TextStyle, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import { type HubUnit, NOTE_LINK_TONE, type NoteLinkTone } from '../../../lib/bike-hub/constants';
import { showActionSheet } from '../../../utils/action-sheet';
import { triggerImpact } from '../../../utils/haptics';
import { noteMeta } from '../overview/notes-block';
import {
  HUB_FIGURE,
  HUB_TOUCH_TARGET,
  type HubColorKey,
  SYSTEM_WEIGHT,
  useHubTheme,
} from '../ui/tokens';
import { NotePhoto } from './note-photo';
import type { HubNote } from './use-notes';

const ACTION_WIDTH = 72;
const OPEN_X = -ACTION_WIDTH * 2;
const SNAP_MS = 180;
/** Above the 44 pt / 48 dp touch target on both platforms. */
const PHOTO_SIZE = 56;
const LINK_SLOP = Math.ceil((HUB_TOUCH_TARGET - 16) / 2);

/** `activate` is the screen reader's double-tap — the same as tapping the row. */
const ACTION = { ACTIVATE: 'activate', EDIT: 'edit', DELETE: 'delete' } as const;

const LINK_COLOR: Record<NoteLinkTone, HubColorKey> = {
  [NOTE_LINK_TONE.LINK]: 'copperText',
  [NOTE_LINK_TONE.QUIET]: 'dim',
};
const LINK_WEIGHT: Record<NoteLinkTone, TextStyle> = {
  [NOTE_LINK_TONE.LINK]: SYSTEM_WEIGHT.semibold,
  [NOTE_LINK_TONE.QUIET]: SYSTEM_WEIGHT.medium,
};

const SENTENCE_END = /[.!?…。！？]$/;

/** Ends a spoken part with one full stop, so a screen reader pauses without reading "..". */
function asSentence(text: string): string {
  const trimmed = text.trim();
  return SENTENCE_END.test(trimmed) ? trimmed : `${trimmed}.`;
}

export interface NoteRowLink {
  label: string;
  onPress: () => void;
  /** Read instead of `label` when the visible label leaves out context (the task's name). */
  accessibilityLabel?: string;
  tone: NoteLinkTone;
  busy?: boolean;
}

interface NoteRowProps {
  note: HubNote;
  unit: HubUnit;
  /** The link on the right of the meta row; `null` renders none. */
  link: NoteRowLink | null;
  /** Tapping the row: opens the note in the Note sheet. */
  onPress: () => void;
  onEdit: () => void;
  onDelete: () => void;
  /** Opens the photo viewer on the photo at `index`. */
  onOpenPhoto: (index: number) => void;
  /** Whether this row is swiped open. The screen keeps at most one open. */
  isSwipeOpen: boolean;
  /** The rider swiped this row open (`true`) or shut (`false`). */
  onSwipeChange: (open: boolean) => void;
  /** An optimistic row that is not saved yet: no tap, swipe, menu or actions. */
  readOnly?: boolean;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * One note: text, photos, a mono meta line and a link. Tapping it opens the
 * note for editing; swiping left reveals Edit · Delete as a shortcut, and the
 * same two are a long-press menu and accessibility actions.
 *
 * Photos and the link are sibling touch targets of the row's text, so a screen
 * reader reaches each one: the note (text, meta, photo count — double-tap to
 * edit), then "Photo 1 of 2", then the link.
 */
export function NoteRow({
  note,
  unit,
  link,
  onPress,
  onEdit,
  onDelete,
  onOpenPhoto,
  isSwipeOpen,
  onSwipeChange,
  readOnly = false,
  isFirst,
  isLast,
}: NoteRowProps) {
  const hub = useHubTheme();
  const { t, i18n } = useTranslation();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const editLabel = t('common.edit');
  const deleteLabel = t('common.delete');

  // Another row opened, the list scrolled, or the rider tapped elsewhere.
  useEffect(() => {
    if (!isSwipeOpen) translateX.value = withTiming(0, { duration: SNAP_MS });
  }, [isSwipeOpen, translateX]);

  const run = (action: () => void) => {
    triggerImpact();
    onSwipeChange(false);
    action();
  };
  const openMenu = () =>
    showActionSheet(note.text.slice(0, 60), [
      { label: editLabel, onPress: onEdit },
      { label: deleteLabel, onPress: onDelete, style: 'destructive' },
      { label: t('common.cancel'), onPress: () => {}, style: 'cancel' },
    ]);

  const pan = Gesture.Pan()
    .enabled(!readOnly)
    .activeOffsetX([-12, 12])
    .failOffsetY([-10, 10])
    .onStart(() => {
      startX.value = translateX.value;
    })
    .onUpdate((event) => {
      translateX.value = Math.min(0, Math.max(OPEN_X, startX.value + event.translationX));
    })
    .onEnd(() => {
      const open = translateX.value < OPEN_X / 2;
      translateX.value = withTiming(open ? OPEN_X : 0, { duration: SNAP_MS });
      runOnJS(onSwipeChange)(open);
    });
  const longPress = Gesture.LongPress()
    .enabled(!readOnly)
    .onStart(() => {
      runOnJS(openMenu)();
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const meta = noteMeta(note, unit, i18n.language);
  const photoCount = note.photos.length;
  const rowLabel = [
    asSentence(note.text),
    asSentence(meta),
    ...(photoCount > 0 ? [t('bikeHub.notesScreen.photoCount', { count: photoCount })] : []),
  ].join(' ');

  return (
    <View
      testID={`note-item-${note.id}`}
      style={{
        overflow: 'hidden',
        backgroundColor: hub.raised,
        borderTopLeftRadius: isFirst ? 16 : 0,
        borderTopRightRadius: isFirst ? 16 : 0,
        borderBottomLeftRadius: isLast ? 16 : 0,
        borderBottomRightRadius: isLast ? 16 : 0,
        borderCurve: 'continuous',
      }}
    >
      <View
        pointerEvents={readOnly ? 'none' : 'auto'}
        style={{ position: 'absolute', top: 0, right: 0, bottom: 0, flexDirection: 'row' }}
        importantForAccessibility="no-hide-descendants"
        accessibilityElementsHidden
      >
        <Pressable
          testID={`note-edit-${note.id}`}
          onPress={() => run(onEdit)}
          style={{ width: ACTION_WIDTH, alignItems: 'center', justifyContent: 'center', gap: 4 }}
        >
          <Pencil size={18} color={hub.text} strokeWidth={2} />
          <Text
            numberOfLines={1}
            style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 12, color: hub.text }}
          >
            {editLabel}
          </Text>
        </Pressable>
        <Pressable
          testID={`note-delete-${note.id}`}
          onPress={() => run(onDelete)}
          style={{
            width: ACTION_WIDTH,
            alignItems: 'center',
            justifyContent: 'center',
            gap: 4,
            backgroundColor: hub.tagCritBg,
          }}
        >
          <Trash2 size={18} color={hub.late} strokeWidth={2} />
          <Text
            numberOfLines={1}
            style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 12, color: hub.late }}
          >
            {deleteLabel}
          </Text>
        </Pressable>
      </View>

      <GestureDetector gesture={Gesture.Race(pan, longPress)}>
        <Animated.View style={rowStyle}>
          {/* Touch only: the row's text below is its accessibility element. */}
          <Pressable
            testID={`note-open-${note.id}`}
            onPress={onPress}
            disabled={readOnly}
            accessible={false}
            style={({ pressed }) => ({
              gap: 8,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: pressed ? hub.raised : hub.card,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: hub.hairline,
            })}
          >
            <View
              testID={`note-row-${note.id}`}
              accessible
              accessibilityRole={readOnly ? 'text' : 'button'}
              accessibilityLabel={rowLabel}
              accessibilityHint={readOnly ? undefined : t('bikeHub.notesScreen.rowHint')}
              accessibilityActions={
                readOnly
                  ? []
                  : [
                      { name: ACTION.ACTIVATE },
                      { name: ACTION.EDIT, label: editLabel },
                      { name: ACTION.DELETE, label: deleteLabel },
                    ]
              }
              onAccessibilityAction={(event) => {
                if (readOnly) return;
                const handlers: Record<string, () => void> = {
                  [ACTION.ACTIVATE]: onPress,
                  [ACTION.EDIT]: onEdit,
                  [ACTION.DELETE]: onDelete,
                };
                handlers[event.nativeEvent.actionName]?.();
              }}
            >
              <Text
                style={{
                  ...SYSTEM_WEIGHT.regular,
                  fontSize: 15,
                  lineHeight: 21,
                  color: hub.textSoft,
                }}
              >
                {note.text}
              </Text>
            </View>
            {photoCount > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                {note.photos.map((photo, index) => (
                  <Pressable
                    key={photo.id}
                    testID={`note-photo-${note.id}-${index}`}
                    onPress={() => {
                      triggerImpact();
                      onOpenPhoto(index);
                    }}
                    disabled={readOnly}
                    accessibilityRole="imagebutton"
                    accessibilityLabel={t('bikeHub.notesScreen.photoOf', {
                      index: index + 1,
                      count: photoCount,
                    })}
                    style={({ pressed }) => ({ opacity: pressed ? 0.7 : 1 })}
                  >
                    <NotePhoto
                      photo={{ storagePath: photo.storagePath, uri: photo.publicUrl }}
                      size={PHOTO_SIZE}
                    />
                  </Pressable>
                ))}
              </View>
            ) : null}
            <View
              style={{
                flexDirection: 'row',
                flexWrap: 'wrap',
                alignItems: 'center',
                justifyContent: 'space-between',
                columnGap: 12,
                rowGap: 4,
              }}
            >
              {/* Already part of the row's accessibility label. */}
              <Text
                importantForAccessibility="no"
                accessibilityElementsHidden
                style={{ ...HUB_FIGURE, fontSize: 14, color: hub.muted }}
              >
                {meta}
              </Text>
              {link ? (
                <Pressable
                  testID={`note-link-${note.id}`}
                  onPress={() => {
                    triggerImpact();
                    link.onPress();
                  }}
                  disabled={link.busy}
                  accessibilityRole="button"
                  accessibilityLabel={link.accessibilityLabel ?? link.label}
                  accessibilityState={{ busy: !!link.busy, disabled: !!link.busy }}
                  hitSlop={{ top: LINK_SLOP, bottom: LINK_SLOP, left: 8, right: 8 }}
                  style={({ pressed }) => ({
                    flexShrink: 1,
                    flexDirection: 'row',
                    alignItems: 'center',
                    gap: 6,
                    opacity: pressed ? 0.6 : 1,
                  })}
                >
                  {link.busy ? (
                    <ActivityIndicator size="small" color={hub[LINK_COLOR[link.tone]]} />
                  ) : null}
                  <Text
                    numberOfLines={1}
                    style={{
                      flexShrink: 1,
                      ...LINK_WEIGHT[link.tone],
                      fontSize: 12,
                      color: hub[LINK_COLOR[link.tone]],
                    }}
                  >
                    {link.label}
                  </Text>
                </Pressable>
              ) : null}
            </View>
          </Pressable>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
