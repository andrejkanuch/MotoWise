import { NOTE_TEXT_MAX } from '@motovault/types';
import { Camera } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { normaliseNoteText } from '../../../lib/bike-hub/notes';
import { triggerImpact } from '../../../utils/haptics';
import { HUB_FONT, HUB_HEIGHT, HUB_RADIUS, hub } from '../ui/tokens';

const MAX_INPUT_HEIGHT = 120;

interface NotesComposerProps {
  /** Saves the text as a note. Resolves `false` when the save failed (the text is kept). */
  onSubmit: (text: string) => Promise<boolean>;
  /** Opens the Note sheet with the draft; `withPhoto` also opens its photo picker. */
  onOpenSheet: (draft: string, withPhoto: boolean) => void;
}

/**
 * Composer bar of the Notes screen: a growing input, a photo button and "Add".
 * "Add" saves the draft directly; with an empty field it opens the Note sheet.
 */
export function NotesComposer({ onSubmit, onOpenSheet }: NotesComposerProps) {
  const { t } = useTranslation();
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);

  const add = async () => {
    triggerImpact();
    const text = normaliseNoteText(draft);
    if (!text) {
      onOpenSheet('', false);
      return;
    }
    setDraft('');
    setFailed(false);
    const ok = await onSubmit(text);
    if (ok) return;
    setDraft(text);
    setFailed(true);
  };

  return (
    <View style={{ gap: 6 }}>
      {failed ? (
        <Text
          accessibilityLiveRegion="polite"
          style={{ fontFamily: HUB_FONT.sans, fontSize: 12, color: hub.late }}
        >
          {t('bikeHub.notes.saveFailed')}
        </Text>
      ) : null}
      <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 8 }}>
        <TextInput
          keyboardAppearance="dark"
          selectionColor={hub.copper}
          testID="notes-composer-input"
          value={draft}
          onChangeText={(text) => {
            setDraft(text);
            if (failed) setFailed(false);
          }}
          multiline
          maxLength={NOTE_TEXT_MAX}
          placeholder={t('bikeHub.notes.placeholder')}
          placeholderTextColor={hub.muted}
          accessibilityLabel={t('bikeHub.notes.inputA11y')}
          style={{
            flex: 1,
            minHeight: HUB_HEIGHT.secondary,
            maxHeight: MAX_INPUT_HEIGHT,
            paddingVertical: 13,
            paddingHorizontal: 14,
            borderRadius: HUB_RADIUS.button,
            borderCurve: 'continuous',
            borderWidth: 1,
            borderColor: failed ? hub.late : hub.ripple,
            backgroundColor: hub.card,
            color: hub.text,
            fontFamily: HUB_FONT.sans,
            fontSize: 15,
          }}
        />
        <Pressable
          testID="notes-composer-photo"
          onPress={() => {
            triggerImpact();
            onOpenSheet(draft, true);
            setDraft('');
          }}
          accessibilityRole="button"
          accessibilityLabel={t('bikeHub.notesScreen.attachPhotoA11y')}
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
          <Camera size={20} color={hub.dim} strokeWidth={1.8} />
        </Pressable>
        <Pressable
          testID="notes-composer-add"
          onPress={add}
          accessibilityRole="button"
          style={({ pressed }) => ({
            height: HUB_HEIGHT.secondary,
            paddingHorizontal: 18,
            borderRadius: HUB_RADIUS.button,
            borderCurve: 'continuous',
            backgroundColor: hub.copper,
            alignItems: 'center',
            justifyContent: 'center',
            opacity: pressed ? 0.85 : 1,
          })}
        >
          <Text style={{ fontFamily: HUB_FONT.sansBold, fontSize: 15, color: hub.ink }}>
            {t('bikeHub.notesScreen.composerAdd')}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}
