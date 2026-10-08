import { Pencil, Trash2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import type { HubUnit } from '../../../lib/bike-hub/constants';
import { showActionSheet } from '../../../utils/action-sheet';
import { triggerImpact } from '../../../utils/haptics';
import { noteMeta } from '../overview/notes-block';
import { HUB_FONT, HUB_TOUCH_TARGET, hub } from '../ui/tokens';
import { NotePhoto } from './note-photo';
import type { HubNote } from './use-notes';

const ACTION_WIDTH = 72;
const OPEN_X = -ACTION_WIDTH * 2;
const SNAP_MS = 180;
const PHOTO_SIZE = 56;
const LINK_SLOP = Math.ceil((HUB_TOUCH_TARGET - 16) / 2);

const ACTION = { EDIT: 'edit', DELETE: 'delete', LINK: 'link' } as const;

export interface NoteRowLink {
  label: string;
  onPress: () => void;
  busy?: boolean;
}

interface NoteRowProps {
  note: HubNote;
  unit: HubUnit;
  /** The link on the right of the meta row; `null` renders none. */
  link: NoteRowLink | null;
  onEdit: () => void;
  onDelete: () => void;
  /** An optimistic row that is not saved yet: no swipe, menu or actions. */
  readOnly?: boolean;
  isFirst: boolean;
  isLast: boolean;
}

/**
 * One note: text, photos, a mono meta line and a link. Swiping left reveals
 * Edit · Delete; the same two are exposed as accessibility actions and in a
 * long-press menu. The row itself is not a pressable, so the link is never
 * nested inside one.
 */
export function NoteRow({
  note,
  unit,
  link,
  onEdit,
  onDelete,
  readOnly = false,
  isFirst,
  isLast,
}: NoteRowProps) {
  const { t, i18n } = useTranslation();
  const translateX = useSharedValue(0);
  const startX = useSharedValue(0);
  const editLabel = t('common.edit');
  const deleteLabel = t('common.delete');

  const close = () => {
    translateX.value = withTiming(0, { duration: SNAP_MS });
  };
  const run = (action: () => void) => {
    triggerImpact();
    close();
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
      translateX.value = withTiming(translateX.value < OPEN_X / 2 ? OPEN_X : 0, {
        duration: SNAP_MS,
      });
    });
  const longPress = Gesture.LongPress()
    .enabled(!readOnly)
    .onStart(() => {
      runOnJS(openMenu)();
    });

  const rowStyle = useAnimatedStyle(() => ({ transform: [{ translateX: translateX.value }] }));
  const meta = noteMeta(note, unit, i18n.language);

  return (
    <View
      testID={`note-row-${note.id}`}
      accessible
      accessibilityLabel={`${note.text}. ${meta}`}
      accessibilityActions={[
        ...(readOnly
          ? []
          : [
              { name: ACTION.EDIT, label: editLabel },
              { name: ACTION.DELETE, label: deleteLabel },
            ]),
        // The row is one accessibility element, so its link is offered as an action too.
        ...(link ? [{ name: ACTION.LINK, label: link.label }] : []),
      ]}
      onAccessibilityAction={(event) => {
        if (event.nativeEvent.actionName === ACTION.LINK) link?.onPress();
        if (readOnly) return;
        if (event.nativeEvent.actionName === ACTION.EDIT) onEdit();
        if (event.nativeEvent.actionName === ACTION.DELETE) onDelete();
      }}
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
          <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 12, color: hub.text }}>
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
          <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 12, color: hub.late }}>
            {deleteLabel}
          </Text>
        </Pressable>
      </View>

      <GestureDetector gesture={Gesture.Race(pan, longPress)}>
        <Animated.View
          style={[
            {
              gap: 6,
              paddingVertical: 14,
              paddingHorizontal: 16,
              backgroundColor: hub.card,
              borderBottomWidth: isLast ? 0 : 1,
              borderBottomColor: hub.hairline,
            },
            rowStyle,
          ]}
        >
          <Text
            style={{ fontFamily: HUB_FONT.sans, fontSize: 15, lineHeight: 21, color: hub.textSoft }}
          >
            {note.text}
          </Text>
          {note.photos.length > 0 ? (
            <View style={{ flexDirection: 'row', gap: 6 }}>
              {note.photos.map((photo) => (
                <NotePhoto
                  key={photo.id}
                  photo={{ storagePath: photo.storagePath, uri: photo.publicUrl }}
                  size={PHOTO_SIZE}
                  accessibilityLabel={t('bikeHub.notesScreen.photoA11y')}
                />
              ))}
            </View>
          ) : null}
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 8,
            }}
          >
            <Text style={{ fontFamily: HUB_FONT.mono, fontSize: 12, color: hub.muted }}>
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
                accessibilityLabel={link.label}
                hitSlop={{ top: LINK_SLOP, bottom: LINK_SLOP, left: 8, right: 8 }}
                style={{ flexShrink: 1, flexDirection: 'row', alignItems: 'center', gap: 6 }}
              >
                {link.busy ? <ActivityIndicator size="small" color={hub.copperText} /> : null}
                <Text
                  numberOfLines={1}
                  style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 12, color: hub.copperText }}
                >
                  {link.label}
                </Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      </GestureDetector>
    </View>
  );
}
