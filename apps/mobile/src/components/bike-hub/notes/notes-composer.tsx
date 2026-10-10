import { NOTE_TEXT_MAX } from '@motovault/types';
import { Camera, Maximize2 } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, useWindowDimensions, View } from 'react-native';
import { normaliseNoteText } from '@/lib/bike-hub/notes';
import { useEditorialTheme } from '@/theme/editorial';
import { triggerImpact } from '@/utils/haptics';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_HEIGHT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  SYSTEM_WEIGHT,
  useHubTheme,
} from '../ui/tokens';
import { useDraftHandoff } from './use-draft-handoff';

const MAX_INPUT_HEIGHT = 120;
/**
 * Past this font scale the field and its three buttons no longer share a row
 * without crushing the field: the buttons move to their own row below it.
 */
const STACK_FONT_SCALE = HUB_CHROME_MAX_FONT_SCALE;

interface NotesComposerProps {
  /** Saves the text as a note. Resolves `false` when the save failed (the text is kept). */
  onSubmit: (text: string) => Promise<boolean>;
  /** Opens the Note sheet with the draft; `withPhoto` also opens its photo picker. */
  onOpenSheet: (draft: string, withPhoto: boolean) => void;
}

/**
 * Composer bar of the Notes screen: a growing field, two quiet buttons that
 * take the draft to the full Note sheet (with a photo, or to write more), and
 * the copper "Add" that saves the text right now. Copper always means "save
 * this text": with an empty field it is disabled, never a hidden "open sheet".
 * The draft stays in the field until that sheet reports it saved a note, so
 * closing the sheet without saving loses nothing.
 */
export function NotesComposer({ onSubmit, onOpenSheet }: NotesComposerProps) {
  const hub = useHubTheme();
  const { isDark } = useEditorialTheme();
  const { t } = useTranslation();
  const { fontScale } = useWindowDimensions();
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const handoff = useDraftHandoff(() => {
    setDraft('');
    setFailed(false);
  });
  const text = normaliseNoteText(draft);
  const stacked = fontScale > STACK_FONT_SCALE;

  const add = async () => {
    if (!text) return;
    triggerImpact();
    handoff.disarm();
    setDraft('');
    setFailed(false);
    const ok = await onSubmit(text);
    if (ok) return;
    setDraft(text);
    setFailed(true);
  };

  const openSheet = (withPhoto: boolean) => {
    triggerImpact();
    handoff.handOff(draft);
    onOpenSheet(draft, withPhoto);
  };

  const field = (
    <TextInput
      keyboardAppearance={isDark ? 'dark' : 'light'}
      selectionColor={hub.copper}
      testID="notes-composer-input"
      value={draft}
      onChangeText={(next) => {
        setDraft(next);
        handoff.disarm();
        if (failed) setFailed(false);
      }}
      multiline
      maxLength={NOTE_TEXT_MAX}
      placeholder={t('bikeHub.notes.placeholder')}
      placeholderTextColor={hub.muted}
      accessibilityLabel={t('bikeHub.notes.inputA11y')}
      style={{
        flex: stacked ? undefined : 1,
        minHeight: HUB_HEIGHT.secondary,
        maxHeight: MAX_INPUT_HEIGHT,
        paddingTop: 13,
        paddingBottom: 13,
        paddingHorizontal: 14,
        borderRadius: HUB_RADIUS.button,
        borderCurve: 'continuous',
        borderWidth: 1,
        borderColor: failed ? hub.late : hub.ripple,
        backgroundColor: hub.card,
        color: hub.text,
        ...SYSTEM_WEIGHT.regular,
        fontSize: 15,
      }}
    />
  );

  const buttons = (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
      <QuietIconButton
        testID="notes-composer-photo"
        label={t('bikeHub.notesScreen.attachPhotoA11y')}
        onPress={() => openSheet(true)}
        icon={<Camera size={20} color={hub.dim} strokeWidth={1.8} />}
      />
      <QuietIconButton
        testID="notes-composer-expand"
        label={t('bikeHub.notes.noteButtonA11y')}
        onPress={() => openSheet(false)}
        icon={<Maximize2 size={18} color={hub.dim} strokeWidth={1.8} />}
      />
      {stacked ? <View style={{ flex: 1 }} /> : null}
      <Pressable
        testID="notes-composer-add"
        onPress={add}
        disabled={!text}
        accessibilityRole="button"
        accessibilityLabel={t('bikeHub.notes.saveA11y')}
        accessibilityState={{ disabled: !text }}
        style={({ pressed }) => ({
          minHeight: HUB_HEIGHT.secondary,
          minWidth: HUB_TOUCH_TARGET,
          paddingHorizontal: 18,
          borderRadius: HUB_RADIUS.button,
          borderCurve: 'continuous',
          backgroundColor: text ? hub.copper : hub.raised,
          alignItems: 'center',
          justifyContent: 'center',
          opacity: pressed ? 0.85 : 1,
        })}
      >
        <Text
          maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
          style={{ ...SYSTEM_WEIGHT.bold, fontSize: 15, color: text ? hub.ink : hub.muted }}
        >
          {t('bikeHub.notesScreen.composerAdd')}
        </Text>
      </Pressable>
    </View>
  );

  return (
    <View style={{ gap: 6 }}>
      {failed ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ ...SYSTEM_WEIGHT.regular, fontSize: 12, color: hub.late }}
        >
          {t('bikeHub.notes.saveFailed')}
        </Text>
      ) : null}
      {stacked ? (
        <View style={{ gap: 8 }}>
          {field}
          {buttons}
        </View>
      ) : (
        <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
          {field}
          {buttons}
        </View>
      )}
    </View>
  );
}

function QuietIconButton({
  testID,
  label,
  onPress,
  icon,
}: {
  testID: string;
  label: string;
  onPress: () => void;
  icon: ReactNode;
}) {
  const hub = useHubTheme();
  return (
    <Pressable
      testID={testID}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={({ pressed }) => ({
        width: HUB_HEIGHT.secondary,
        height: HUB_HEIGHT.secondary,
        borderRadius: HUB_RADIUS.button,
        borderCurve: 'continuous',
        backgroundColor: hub.card,
        borderWidth: 1,
        borderColor: hub.ripple,
        alignItems: 'center',
        justifyContent: 'center',
        opacity: pressed ? 0.7 : 1,
      })}
    >
      {icon}
    </Pressable>
  );
}
