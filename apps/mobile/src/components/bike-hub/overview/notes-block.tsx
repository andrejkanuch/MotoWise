import { NOTE_TEXT_MAX } from '@motovault/types';
import { Plus } from 'lucide-react-native';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import { type HubUnit, NOTE_SOURCE, OVERVIEW_NOTES_SHOWN } from '../../../lib/bike-hub/constants';
import { formatOdometer, formatShortDate, hasOdometer } from '../../../lib/bike-hub/format';
import { normaliseNoteText } from '../../../lib/bike-hub/notes';
import { triggerImpact } from '../../../utils/haptics';
import { type HubNote, useCreateNote } from '../notes/use-notes';
import { HubCard } from '../ui/hub-card';
import { SectionHeader } from '../ui/section-header';
import { HUB_FONT, HUB_HEIGHT, HUB_RADIUS, HUB_TOUCH_TARGET, hub } from '../ui/tokens';

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
  onOpenNotes: () => void;
  /** Opens the Note sheet, carrying whatever is typed in the quick-add field. */
  onOpenNoteSheet: (draft: string) => void;
}

/**
 * "Notes · N": the two newest notes and a quick-add row. Return sends the note
 * with the current odometer stamp; "Note" opens the full sheet with the draft.
 */
export function NotesBlock({
  motorcycleId,
  odometer,
  unit,
  notes,
  isLoading,
  isError,
  onRetry,
  onOpenNotes,
  onOpenNoteSheet,
}: NotesBlockProps) {
  const { t, i18n } = useTranslation();
  const [draft, setDraft] = useState('');
  const [failed, setFailed] = useState(false);
  const createNote = useCreateNote();
  const shown = notes.slice(0, OVERVIEW_NOTES_SHOWN);

  const send = () => {
    const text = normaliseNoteText(draft);
    if (!text) return;
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
            <Text style={{ flex: 1, fontFamily: HUB_FONT.sans, fontSize: 14, color: hub.dim }}>
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
              <Text
                style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.copperText }}
              >
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
              style={{ fontFamily: HUB_FONT.sans, fontSize: 14, lineHeight: 19, color: hub.text }}
            >
              {note.text}
            </Text>
            <Text style={{ fontFamily: HUB_FONT.mono, fontSize: 12, color: hub.muted }}>
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
            testID="quick-note-input"
            value={draft}
            onChangeText={(text) => {
              setDraft(text);
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
              height: HUB_HEIGHT.small,
              paddingVertical: 0,
              paddingHorizontal: 12,
              borderRadius: HUB_RADIUS.chip,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: failed ? hub.late : hub.hairlineStrong,
              backgroundColor: hub.ground,
              color: hub.text,
              fontFamily: HUB_FONT.sans,
              fontSize: 14,
            }}
          />
          <Pressable
            testID="quick-note-open-sheet"
            onPress={() => {
              triggerImpact();
              onOpenNoteSheet(draft);
              setDraft('');
            }}
            accessibilityRole="button"
            accessibilityLabel={t('bikeHub.notes.noteButtonA11y')}
            hitSlop={{ top: INPUT_SLOP, bottom: INPUT_SLOP }}
            style={({ pressed }) => ({
              height: HUB_HEIGHT.small,
              paddingHorizontal: 12,
              borderRadius: HUB_RADIUS.chip,
              borderCurve: 'continuous',
              backgroundColor: hub.copper,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            <Plus size={16} color={hub.ink} strokeWidth={2.5} />
            <Text style={{ fontFamily: HUB_FONT.sansBold, fontSize: 13, color: hub.ink }}>
              {t('bikeHub.notes.noteButton')}
            </Text>
          </Pressable>
        </View>
        {failed ? (
          <Text
            accessibilityLiveRegion="polite"
            style={{
              fontFamily: HUB_FONT.sans,
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
