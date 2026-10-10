import { NOTE_TEXT_MAX } from '@motovault/types';
import { Maximize2 } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { type HubUnit, NOTE_SOURCE, OVERVIEW_NOTES_SHOWN } from '@/lib/bike-hub/constants';
import { formatOdometer, formatShortDate, hasOdometer } from '@/lib/bike-hub/format';
import { normaliseNoteText } from '@/lib/bike-hub/notes';
import { useEditorialTheme } from '@/theme/editorial';
import { triggerImpact } from '@/utils/haptics';
import { useDraftHandoff } from '../notes/use-draft-handoff';
import { type HubNote, useCreateNote } from '../notes/use-notes';
import { HubCard } from '../ui/hub-card';
import { REFRESH_BLOCK, RefreshFailed } from '../ui/refresh-failed';
import { SectionHeader } from '../ui/section-header';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FIGURE,
  HUB_HEIGHT,
  HUB_RADIUS,
  HUB_TOUCH_TARGET,
  SYSTEM_WEIGHT,
  useHubTheme,
} from '../ui/tokens';

const SEPARATOR = ' · ';
const INPUT_SLOP = Math.ceil((HUB_TOUCH_TARGET - HUB_HEIGHT.small) / 2);

/** "Sep 28 · 38,100 km" — the odometer part is left out when the note has no stamp. */
export function noteMeta(
  note: Pick<HubNote, 'createdAt' | 'odometer'>,
  unit: HubUnit,
  language: string,
): string {
  const date = formatShortDate(note.createdAt, language);
  if (!hasOdometer(note.odometer)) return date;
  return `${date}${SEPARATOR}${formatOdometer(note.odometer, language)} ${unit}`;
}

interface NotesBlockProps {
  motorcycleId: string;
  /** The bike's current odometer — stamped on a quick note. */
  odometer: number | null | undefined;
  unit: HubUnit;
  notes: readonly HubNote[];
  isLoading: boolean;
  isError: boolean;
  onRetry: () => void;
  /** Notes are from the cache: the latest refetch failed. */
  refreshFailed?: boolean;
  onOpenNotes: () => void;
  /** Opens the Note sheet, carrying whatever is typed in the quick-add field. */
  onOpenNoteSheet: (draft: string) => void;
}

/**
 * "Notes · N": the two newest notes and a quick-add row. The copper "Add" (or
 * Return) saves the text now with the current odometer stamp — copper always
 * means "save this text", so it is disabled while the field is empty. The quiet
 * expand button takes the draft to the full Note sheet; the draft stays in the
 * field until that sheet reports it saved a note, so closing the sheet loses
 * nothing and an unrelated note never clears it.
 */
export function NotesBlock({
  motorcycleId,
  odometer,
  unit,
  notes,
  isLoading,
  isError,
  onRetry,
  refreshFailed = false,
  onOpenNotes,
  onOpenNoteSheet,
}: NotesBlockProps) {
  const hub = useHubTheme();
  const { isDark } = useEditorialTheme();
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const createNote = useCreateNote();
  const shown = notes.slice(0, OVERVIEW_NOTES_SHOWN);
  const handoff = useDraftHandoff(() => {
    setDraft('');
    setFailed(false);
  });
  const text = normaliseNoteText(draft);

  const send = () => {
    if (!text) return;
    handoff.disarm();
    setDraft('');
    setFailed(false);
    triggerImpact();
    createNote.mutate(
      {
        motorcycleId,
        text,
        // An unset odometer (null or 0) leaves the note unstamped.
        odometer: hasOdometer(odometer) ? odometer : null,
        source: NOTE_SOURCE.OVERVIEW_QUICK,
      },
      {
        // Give the text back so nothing typed is lost.
        onError: () => {
          setDraft(text);
          setFailed(true);
        },
      },
    );
  };

  return (
    <View testID="notes-block" style={{ gap: 8 }}>
      <SectionHeader
        label={t('bikeHub.notes.title')}
        count={isLoading || isError ? undefined : notes.length}
        action={
          notes.length > 0 ? { label: t('bikeHub.notes.all'), onPress: onOpenNotes } : undefined
        }
      />
      {refreshFailed ? (
        <RefreshFailed
          block={REFRESH_BLOCK.NOTES}
          testID="notes-refresh-failed"
          onRetry={onRetry}
        />
      ) : null}
      <HubCard style={{ overflow: 'hidden' }}>
        {isLoading ? (
          <View
            testID="notes-loading"
            accessibilityLabel={t('common.loading')}
            style={{
              height: 64,
              borderBottomWidth: 1,
              borderBottomColor: hub.hairline,
              opacity: 0.6,
            }}
          />
        ) : null}
        {isError ? (
          <View
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 12,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: hub.hairline,
            }}
          >
            <Text style={{ flex: 1, ...SYSTEM_WEIGHT.regular, fontSize: 14, color: hub.dim }}>
              {t('bikeHub.notes.loadError')}
            </Text>
            <Pressable
              onPress={onRetry}
              accessibilityRole="button"
              style={{
                minHeight: HUB_TOUCH_TARGET,
                justifyContent: 'center',
                paddingHorizontal: 8,
              }}
            >
              <Text style={{ ...SYSTEM_WEIGHT.semibold, fontSize: 14, color: hub.copperText }}>
                {t('common.retry')}
              </Text>
            </Pressable>
          </View>
        ) : null}
        {shown.map((note) => (
          <Pressable
            key={note.id}
            testID={`overview-note-${note.id}`}
            onPress={() => {
              triggerImpact();
              onOpenNotes();
            }}
            accessibilityRole="button"
            accessibilityLabel={`${note.text}. ${noteMeta(note, unit, i18n.language)}`}
            style={({ pressed }) => ({
              gap: 3,
              paddingVertical: 12,
              paddingHorizontal: 14,
              borderBottomWidth: 1,
              borderBottomColor: hub.hairline,
              opacity: pressed ? 0.7 : 1,
            })}
          >
            <Text
              numberOfLines={3}
              style={{ ...SYSTEM_WEIGHT.regular, fontSize: 14, lineHeight: 19, color: hub.text }}
            >
              {note.text}
            </Text>
            <Text style={{ ...HUB_FIGURE, fontSize: 14, color: hub.muted }}>
              {noteMeta(note, unit, i18n.language)}
            </Text>
          </Pressable>
        ))}

        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 10,
            paddingVertical: 10,
            paddingHorizontal: 14,
          }}
        >
          <TextInput
            keyboardAppearance={isDark ? 'dark' : 'light'}
            selectionColor={hub.copper}
            testID="quick-note-input"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
              handoff.disarm();
              if (failed) setFailed(false);
            }}
            onSubmitEditing={send}
            placeholder={t('bikeHub.notes.placeholder')}
            placeholderTextColor={hub.muted}
            accessibilityLabel={t('bikeHub.notes.inputA11y')}
            maxLength={NOTE_TEXT_MAX}
            returnKeyType="send"
            submitBehavior="submit"
            hitSlop={{ top: INPUT_SLOP, bottom: INPUT_SLOP }}
            style={{
              flex: 1,
              minHeight: HUB_HEIGHT.small,
              paddingVertical: 6,
              paddingHorizontal: 12,
              borderRadius: HUB_RADIUS.chip,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: failed ? hub.late : hub.hairlineStrong,
              backgroundColor: hub.ground,
              color: hub.text,
              ...SYSTEM_WEIGHT.regular,
              fontSize: 14,
            }}
          />
          <Pressable
            testID="quick-note-open-sheet"
            onPress={() => {
              triggerImpact();
              handoff.handOff(draft);
              onOpenNoteSheet(draft);
            }}
            accessibilityRole="button"
            accessibilityLabel={t('bikeHub.notes.noteButtonA11y')}
            hitSlop={{ top: INPUT_SLOP, bottom: INPUT_SLOP, left: 4, right: 4 }}
            style={({ pressed }) => ({
              width: HUB_HEIGHT.small,
              height: HUB_HEIGHT.small,
              borderRadius: HUB_RADIUS.chip,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: hub.hairlineStrong,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <Maximize2 size={16} color={hub.dim} strokeWidth={1.8} />
          </Pressable>
          <Pressable
            testID="quick-note-add"
            onPress={send}
            disabled={!text}
            accessibilityRole="button"
            accessibilityLabel={t('bikeHub.notes.saveA11y')}
            accessibilityState={{ disabled: !text }}
            hitSlop={{ top: INPUT_SLOP, bottom: INPUT_SLOP }}
            style={({ pressed }) => ({
              minHeight: HUB_HEIGHT.small,
              paddingHorizontal: 14,
              borderRadius: HUB_RADIUS.chip,
              borderCurve: 'continuous',
              backgroundColor: text ? hub.copper : hub.raised,
              alignItems: 'center',
              justifyContent: 'center',
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Text
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              style={{
                ...SYSTEM_WEIGHT.bold,
                fontSize: 13,
                color: text ? hub.ink : hub.muted,
              }}
            >
              {t('bikeHub.notesScreen.composerAdd')}
            </Text>
          </Pressable>
        </View>
        {failed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              ...SYSTEM_WEIGHT.regular,
              fontSize: 12,
              color: hub.late,
              paddingHorizontal: 14,
              paddingBottom: 10,
            }}
          >
            {t('bikeHub.notes.saveFailed')}
          </Text>
        ) : null}
      </HubCard>
    </View>
  );
}
