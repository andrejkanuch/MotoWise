import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../../hooks/use-currency';
import {
  BIKE_SEGMENT,
  type BikeSegment,
  NOTE_LINK,
  NOTE_SOURCE,
  NOTES_SEARCH_DEBOUNCE_MS,
  type NoteLinkKind,
} from '../../../lib/bike-hub/constants';
import { bikeDisplayName, hasOdometer, toHubUnit } from '../../../lib/bike-hub/format';
import { filterNotes, getNoteLink } from '../../../lib/bike-hub/notes';
import { isBikeSegment } from '../../../lib/bike-hub/segments';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import type { HubBike } from '../shell/use-bike-hub-data';
import { SEGMENT_LABEL_KEY } from '../ui/segment-bar';
import {
  HUB_FONT,
  HUB_TAB_BAR_HEIGHT,
  HUB_TAB_BAR_MIN_INSET,
  HUB_TOUCH_TARGET,
  hub,
} from '../ui/tokens';
import { UndoSnackbar } from '../ui/undo-snackbar';
import { useDeferredDelete } from '../ui/use-deferred-delete';
import { NoteRow, type NoteRowLink } from './note-row';
import { NotesComposer } from './notes-composer';
import {
  type HubNote,
  isOptimisticNote,
  useCreateNote,
  useCreateTaskFromNote,
  useDeleteNote,
  useNotes,
} from './use-notes';

const SKELETON_ROWS = 3;

interface NotesScreenProps {
  bike: HubBike;
  /** `from` route param: the segment the screen was opened from. */
  from?: string;
}

/**
 * All notes of a bike: newest first, searchable, swipe for edit / delete (with
 * a 5 s undo), and a composer bar that stays above the keyboard and the tab bar.
 */
export function NotesScreen({ bike, from }: NotesScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { formatFor } = useCurrency();
  const unit = toHubUnit(bike.distanceUnit);
  const origin: BikeSegment = isBikeSegment(from) ? from : BIKE_SEGMENT.OVERVIEW;
  const { notes, isLoading, isError, refetch } = useNotes(bike.id);
  const createNote = useCreateNote();
  const createTask = useCreateTaskFromNote(bike.id);
  const { mutateAsync: deleteNote } = useDeleteNote(bike.id);

  const [query, setQuery] = useState('');
  const [search, setSearch] = useState('');
  useEffect(() => {
    const timer = setTimeout(() => setSearch(query), NOTES_SEARCH_DEBOUNCE_MS);
    return () => clearTimeout(timer);
  }, [query]);

  const deferred = useDeferredDelete({
    commit: deleteNote,
    onError: () => Alert.alert(t('common.error'), t('bikeHub.notesScreen.deleteFailed')),
  });
  // Leaving the screen closes the undo window: the delete is sent at once.
  const { flush } = deferred;
  useFocusEffect(useCallback(() => flush, [flush]));

  const visible = filterNotes(notes, search);
  const tabBarClearance = Math.max(insets.bottom, HUB_TAB_BAR_MIN_INSET) + HUB_TAB_BAR_HEIGHT;

  const openSheet = (params: { noteId?: string; draft?: string; photo?: boolean }) => {
    const href: Href = {
      pathname: '/(tabs)/(garage)/note',
      params: {
        motorcycleId: bike.id,
        ...(params.noteId ? { noteId: params.noteId } : {}),
        ...(params.draft ? { draft: params.draft } : {}),
        ...(params.photo ? { photo: '1' } : {}),
      },
    };
    router.push(href);
  };

  // This screen sits on top of the bike hub. Going back to that hub and asking
  // it for the task keeps one hub on the stack; navigating to `bike/[id]` from
  // here could mount a second one. Without a hub beneath (a future deep link),
  // open the bike with the task as its landing.
  const requestTask = useBikeHubStore((state) => state.requestTask);
  const openLinkedTask = (taskId: string) => {
    if (router.canGoBack()) {
      requestTask(bike.id, taskId);
      router.back();
      return;
    }
    router.replace({
      pathname: '/(tabs)/(garage)/bike/[id]',
      params: { id: bike.id, segment: BIKE_SEGMENT.SERVICE, highlightTask: taskId },
    });
  };

  const linkFor = (note: HubNote): NoteRowLink | null => {
    if (isOptimisticNote(note)) return null;
    const links: Record<NoteLinkKind, () => NoteRowLink> = {
      [NOTE_LINK.TASK]: () => ({
        label: note.linkedTaskTitle ?? t('bikeHub.log.task'),
        onPress: () => openLinkedTask(note.linkedTaskId ?? ''),
      }),
      [NOTE_LINK.EXPENSE]: () => ({
        label: t('bikeHub.notesScreen.linkedExpense', {
          amount: formatFor(note.linkedExpenseAmount ?? 0, note.linkedExpenseCurrency),
        }),
        onPress: () =>
          router.push({
            pathname: '/(tabs)/(garage)/expense-detail',
            params: { expenseId: note.linkedExpenseId ?? '', motorcycleId: bike.id },
          }),
      }),
      [NOTE_LINK.MAKE_TASK]: () => ({
        label: t('bikeHub.notesScreen.makeTask'),
        busy: createTask.isPending && createTask.variables === note.id,
        onPress: () =>
          createTask.mutate(note.id, {
            onError: () => Alert.alert(t('common.error'), t('bikeHub.notesScreen.makeTaskFailed')),
          }),
      }),
    };
    return links[getNoteLink(note)]();
  };

  const submit = async (text: string): Promise<boolean> => {
    try {
      await createNote.mutateAsync({
        motorcycleId: bike.id,
        text,
        // An unset odometer (null or 0) leaves the note unstamped.
        odometer: hasOdometer(bike.currentMileage) ? bike.currentMileage : null,
        source: NOTE_SOURCE.NOTES_COMPOSER,
      });
      return true;
    } catch (_error) {
      return false;
    }
  };

  const listHeader = (
    <View style={{ gap: 12, paddingBottom: 12 }}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: 12,
          paddingHorizontal: 2,
        }}
      >
        <Text
          accessibilityRole="header"
          style={{ fontFamily: HUB_FONT.serif, fontSize: 30, color: hub.text }}
        >
          {t('bikeHub.notesScreen.count', { count: notes.length })}
        </Text>
        <Text
          numberOfLines={1}
          style={{ flexShrink: 1, fontFamily: HUB_FONT.sans, fontSize: 12, color: hub.muted }}
        >
          {t('bikeHub.notesScreen.hint')}
        </Text>
      </View>
      <TextInput
        testID="notes-search"
        value={query}
        onChangeText={setQuery}
        placeholder={t('bikeHub.notesScreen.searchPlaceholder')}
        placeholderTextColor={hub.muted}
        accessibilityLabel={t('bikeHub.notesScreen.searchA11y')}
        returnKeyType="search"
        clearButtonMode="while-editing"
        autoCorrect={false}
        hitSlop={{ top: 2, bottom: 2 }}
        style={{
          height: 40,
          paddingVertical: 0,
          paddingHorizontal: 12,
          borderRadius: 11,
          borderCurve: 'continuous',
          borderWidth: 1,
          borderColor: hub.hairlineStrong,
          backgroundColor: hub.card,
          color: hub.text,
          fontFamily: HUB_FONT.sans,
          fontSize: 14,
        }}
      />
    </View>
  );

  const emptyState = () => {
    if (isLoading) {
      return (
        <View
          testID="notes-screen-loading"
          accessibilityLabel={t('common.loading')}
          style={{ gap: 1 }}
        >
          {Array.from({ length: SKELETON_ROWS }, (_, index) => `skeleton-${index}`).map((key) => (
            <View key={key} style={{ height: 84, backgroundColor: hub.card, opacity: 0.6 }} />
          ))}
        </View>
      );
    }
    if (isError) {
      return (
        <StateMessage
          title={t('bikeHub.notes.loadError')}
          action={{ label: t('common.retry'), onPress: refetch }}
        />
      );
    }
    if (search.trim()) {
      return <StateMessage title={t('bikeHub.notesScreen.noMatch', { query: search.trim() })} />;
    }
    return (
      <StateMessage
        title={t('bikeHub.notesScreen.empty')}
        body={t('bikeHub.notesScreen.emptySub')}
      />
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: hub.ground }}>
      <View
        style={{
          paddingTop: insets.top,
          paddingHorizontal: 8,
          borderBottomWidth: 1,
          borderBottomColor: hub.hairline,
        }}
      >
        <View style={{ height: 48, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            testID="notes-back"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('bikeHub.header.backTo', {
              origin: t(SEGMENT_LABEL_KEY[origin]),
            })}
            style={({ pressed }) => ({
              minWidth: 92,
              height: HUB_TOUCH_TARGET,
              paddingLeft: 4,
              paddingRight: 8,
              flexDirection: 'row',
              alignItems: 'center',
              gap: 2,
              opacity: pressed ? 0.6 : 1,
            })}
          >
            <ChevronLeft size={22} color={hub.copperText} strokeWidth={2.2} />
            <Text
              style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.copperText }}
            >
              {t(SEGMENT_LABEL_KEY[origin])}
            </Text>
          </Pressable>
          <Text
            numberOfLines={1}
            style={{
              flex: 1,
              textAlign: 'center',
              fontFamily: HUB_FONT.sansSemiBold,
              fontSize: 15,
              color: hub.text,
            }}
          >
            {t('bikeHub.notesScreen.title', { name: bikeDisplayName(bike) })}
          </Text>
          <View style={{ width: 92 }} />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(note) => note.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        contentContainerStyle={{ padding: 16 }}
        ListHeaderComponent={listHeader}
        ListEmptyComponent={emptyState}
        renderItem={({ item, index }) => (
          <NoteRow
            note={item}
            unit={unit}
            link={linkFor(item)}
            // Not saved yet: no id to edit or delete.
            readOnly={isOptimisticNote(item)}
            isFirst={index === 0}
            isLast={index === visible.length - 1}
            onEdit={() => openSheet({ noteId: item.id })}
            onDelete={() => deferred.request(item.id)}
          />
        )}
      />

      <KeyboardStickyView offset={{ closed: 0, opened: tabBarClearance }}>
        <View
          style={{
            gap: 8,
            paddingTop: 10,
            paddingHorizontal: 16,
            paddingBottom: tabBarClearance + 10,
            borderTopWidth: 1,
            borderTopColor: hub.hairline,
            backgroundColor: hub.ground,
          }}
        >
          {deferred.pendingId ? (
            <UndoSnackbar
              message={t('bikeHub.notesScreen.deleted')}
              action={{ label: t('bikeHub.undo'), onPress: deferred.undo }}
            />
          ) : null}
          <NotesComposer
            onSubmit={submit}
            onOpenSheet={(draft, withPhoto) => openSheet({ draft, photo: withPhoto })}
          />
        </View>
      </KeyboardStickyView>
    </View>
  );
}

function StateMessage({
  title,
  body,
  action,
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={{ alignItems: 'center', gap: 6, paddingVertical: 32, paddingHorizontal: 16 }}>
      <Text
        style={{
          fontFamily: HUB_FONT.sansSemiBold,
          fontSize: 15,
          color: hub.text,
          textAlign: 'center',
        }}
      >
        {title}
      </Text>
      {body ? (
        <Text
          style={{
            fontFamily: HUB_FONT.sans,
            fontSize: 13,
            lineHeight: 18,
            color: hub.dim,
            textAlign: 'center',
          }}
        >
          {body}
        </Text>
      ) : null}
      {action ? (
        <Pressable
          onPress={action.onPress}
          accessibilityRole="button"
          style={{ minHeight: HUB_TOUCH_TARGET, justifyContent: 'center', paddingHorizontal: 12 }}
        >
          <Text style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 14, color: hub.copperText }}>
            {action.label}
          </Text>
        </Pressable>
      ) : null}
    </View>
  );
}
