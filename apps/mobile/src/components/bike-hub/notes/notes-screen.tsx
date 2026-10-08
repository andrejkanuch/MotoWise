import { MaintenanceTaskStatus } from '@motovault/graphql';
import { type Href, useFocusEffect, useRouter } from 'expo-router';
import { ChevronLeft } from 'lucide-react-native';
import { useCallback, useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Alert, FlatList, Pressable, RefreshControl, Text, TextInput, View } from 'react-native';
import { KeyboardStickyView } from 'react-native-keyboard-controller';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useCurrency } from '../../../hooks/use-currency';
import {
  BIKE_SEGMENT,
  type BikeSegment,
  NOTE_LINK,
  NOTE_LINK_TONE,
  NOTE_SOURCE,
  NOTES_SEARCH_DEBOUNCE_MS,
  type NoteLinkKind,
} from '../../../lib/bike-hub/constants';
import { bikeDisplayName, hasOdometer, toHubUnit } from '../../../lib/bike-hub/format';
import { filterNotes, getNoteLink } from '../../../lib/bike-hub/notes';
import { isBikeSegment } from '../../../lib/bike-hub/segments';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import type { HubBike } from '../shell/use-bike-hub-data';
import { useGuardedPush } from '../shell/use-guarded-push';
import { useHubBottomLayout } from '../ui/bottom-layout';
import { REFRESH_BLOCK, RefreshFailed } from '../ui/refresh-failed';
import { SEGMENT_LABEL_KEY } from '../ui/segment-bar';
import {
  HUB_CHROME_MAX_FONT_SCALE,
  HUB_FONT,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
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
  useTaskStatuses,
} from './use-notes';

const SKELETON_ROWS = 3;
const HEADER_SIDE_WIDTH = 92;
/** Room between the composer bar and the keyboard while the keyboard is up. */
const COMPOSER_KEYBOARD_GAP = 10;

/** A linked task's status, as the word its link shows. */
const TASK_STATUS_KEY: Record<MaintenanceTaskStatus, HubCopyKey> = {
  [MaintenanceTaskStatus.Pending]: 'bikeHub.notesScreen.taskStatus.open',
  [MaintenanceTaskStatus.InProgress]: 'bikeHub.notesScreen.taskStatus.inProgress',
  [MaintenanceTaskStatus.Completed]: 'bikeHub.notesScreen.taskStatus.done',
  [MaintenanceTaskStatus.Skipped]: 'bikeHub.notesScreen.taskStatus.skipped',
};

interface NotesScreenProps {
  bike: HubBike;
  /** `from` route param: the segment the screen was opened from. */
  from?: string;
}

/**
 * All notes of a bike: newest first, searchable, pull to refresh. Tap a note to
 * edit it in the Note sheet; swipe it for edit / delete (5 s undo), one row
 * open at a time; tap a photo for the full-screen viewer. The composer bar
 * stays above the keyboard and the tab bar.
 */
export function NotesScreen({ bike, from }: NotesScreenProps) {
  const { t } = useTranslation();
  const router = useRouter();
  // Row taps, composer buttons and photos open sheets/leaves through the hub's
  // focus + cooldown guard: a fast double tap never stacks two sheets.
  const push = useGuardedPush();
  const insets = useSafeAreaInsets();
  const { formatFor } = useCurrency();
  const unit = toHubUnit(bike.distanceUnit);
  const origin: BikeSegment = isBikeSegment(from) ? from : BIKE_SEGMENT.OVERVIEW;
  const { notes, isLoading, isError, refreshFailed, refetch, refresh } = useNotes(bike.id);
  const taskStatuses = useTaskStatuses(bike.id);
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
  const searching = search.trim().length > 0;
  // The composer clears the floating tab bar (and its opaque dock) by the same
  // gap as the hub's floating action pill.
  const { pillBottom: composerBottom } = useHubBottomLayout();

  // At most one row is swiped open; scrolling or tapping another row shuts it.
  const [swipeOpenId, setSwipeOpenId] = useState<string | null>(null);
  const pressRow = (noteId: string) => {
    if (swipeOpenId) {
      setSwipeOpenId(null);
      return;
    }
    openSheet({ noteId });
  };

  const [refreshing, setRefreshing] = useState(false);
  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await refresh();
    } finally {
      setRefreshing(false);
    }
  };

  const clearSearch = () => {
    setQuery('');
    setSearch('');
  };

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
    push(href);
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

  const openPhoto = (noteId: string, index: number) =>
    push({
      pathname: '/(tabs)/(garage)/note-photos',
      params: { motorcycleId: bike.id, noteId, index: String(index) },
    });

  const taskLink = (note: HubNote): NoteRowLink => {
    // A task made from a note carries the note's own words as its title, so the
    // link says where the task stands instead of repeating the text.
    const status = note.linkedTaskId ? taskStatuses.get(note.linkedTaskId) : undefined;
    const title = note.linkedTaskTitle ?? '';
    const statusWord = status ? t(TASK_STATUS_KEY[status]) : null;
    return {
      label: statusWord
        ? t('bikeHub.notesScreen.taskLink', { status: statusWord })
        : t('bikeHub.notesScreen.linkedTask'),
      accessibilityLabel: statusWord
        ? t('bikeHub.notesScreen.taskLinkA11y', { title, status: statusWord })
        : t('bikeHub.notesScreen.linkedTaskA11y', { title }),
      tone: NOTE_LINK_TONE.LINK,
      onPress: () => openLinkedTask(note.linkedTaskId ?? ''),
    };
  };

  const linkFor = (note: HubNote): NoteRowLink | null => {
    if (isOptimisticNote(note)) return null;
    const links: Record<NoteLinkKind, () => NoteRowLink> = {
      [NOTE_LINK.TASK]: () => taskLink(note),
      [NOTE_LINK.EXPENSE]: () => ({
        tone: NOTE_LINK_TONE.LINK,
        label: t('bikeHub.notesScreen.linkedExpense', {
          amount: formatFor(note.linkedExpenseAmount ?? 0, note.linkedExpenseCurrency),
        }),
        onPress: () =>
          push({
            pathname: '/(tabs)/(garage)/expense-detail',
            params: { expenseId: note.linkedExpenseId ?? '', motorcycleId: bike.id },
          }),
      }),
      [NOTE_LINK.MAKE_TASK]: () => ({
        tone: NOTE_LINK_TONE.QUIET,
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

  const hasNotes = notes.length > 0;
  // Nothing to search or count yet: the empty state and the composer lead.
  const listHeader =
    hasNotes || searching || refreshFailed ? (
      <View style={{ gap: 12, paddingBottom: 12 }}>
        {refreshFailed ? (
          <RefreshFailed
            block={REFRESH_BLOCK.NOTES}
            testID="notes-screen-refresh-failed"
            onRetry={refetch}
          />
        ) : null}
        {hasNotes ? (
          <Text
            accessibilityRole="header"
            style={{
              paddingHorizontal: 2,
              fontFamily: HUB_FONT.serif,
              fontSize: 30,
              color: hub.text,
            }}
          >
            {t('bikeHub.notesScreen.count', { count: notes.length })}
          </Text>
        ) : null}
        {hasNotes || searching ? (
          <TextInput
            keyboardAppearance="dark"
            selectionColor={hub.copper}
            testID="notes-search"
            value={query}
            onChangeText={setQuery}
            onFocus={() => setSwipeOpenId(null)}
            placeholder={t('bikeHub.notesScreen.searchPlaceholder')}
            placeholderTextColor={hub.muted}
            accessibilityLabel={t('bikeHub.notesScreen.searchA11y')}
            returnKeyType="search"
            clearButtonMode="while-editing"
            autoCorrect={false}
            style={{
              minHeight: HUB_TOUCH_TARGET,
              paddingVertical: 10,
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
        ) : null}
        {searching && visible.length > 0 ? (
          <Text
            testID="notes-match-count"
            accessibilityLiveRegion="polite"
            style={{
              paddingHorizontal: 2,
              fontFamily: HUB_FONT.sans,
              fontSize: 13,
              color: hub.dim,
            }}
          >
            {t('bikeHub.notesScreen.matchCount', { count: visible.length })}
          </Text>
        ) : null}
      </View>
    ) : null;

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
    if (searching) {
      return (
        <StateMessage
          title={t('bikeHub.notesScreen.noMatch', { query: search.trim() })}
          action={{ label: t('bikeHub.notesScreen.clearSearch'), onPress: clearSearch }}
        />
      );
    }
    // First use: say what belongs here, and point at the field right below.
    return (
      <StateMessage
        testID="notes-screen-empty"
        title={t('bikeHub.notesScreen.emptyTitle')}
        body={t(
          hasOdometer(bike.currentMileage)
            ? 'bikeHub.notesScreen.emptyBodyStamped'
            : 'bikeHub.notesScreen.emptyBody',
        )}
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
        <View style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center' }}>
          <Pressable
            testID="notes-back"
            onPress={() => router.back()}
            accessibilityRole="button"
            accessibilityLabel={t('bikeHub.header.backTo', {
              origin: t(SEGMENT_LABEL_KEY[origin]),
            })}
            style={({ pressed }) => ({
              minWidth: HEADER_SIDE_WIDTH,
              minHeight: HUB_TOUCH_TARGET,
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
              maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
              numberOfLines={1}
              style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.copperText }}
            >
              {t(SEGMENT_LABEL_KEY[origin])}
            </Text>
          </Pressable>
          <Text
            accessibilityRole="header"
            maxFontSizeMultiplier={HUB_CHROME_MAX_FONT_SCALE}
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
          <View style={{ width: HEADER_SIDE_WIDTH }} />
        </View>
      </View>

      <FlatList
        data={visible}
        keyExtractor={(note) => note.id}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        // `flexGrow` lets the empty state fill (and scroll within) the room above
        // the composer; at the largest text sizes it scrolls instead of being
        // cut off behind the bar.
        contentContainerStyle={{ padding: 16, flexGrow: 1 }}
        onScrollBeginDrag={() => setSwipeOpenId(null)}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={hub.copper}
            colors={[hub.copper]}
            progressBackgroundColor={hub.raised}
          />
        }
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
            onPress={() => pressRow(item.id)}
            onEdit={() => openSheet({ noteId: item.id })}
            onDelete={() => deferred.request(item.id)}
            onOpenPhoto={(photoIndex) => openPhoto(item.id, photoIndex)}
            isSwipeOpen={swipeOpenId === item.id}
            onSwipeChange={(open) =>
              setSwipeOpenId((current) => (open ? item.id : current === item.id ? null : current))
            }
          />
        )}
      />

      <KeyboardStickyView offset={{ closed: 0, opened: composerBottom - COMPOSER_KEYBOARD_GAP }}>
        <View
          style={{
            gap: 8,
            paddingTop: 10,
            paddingHorizontal: 16,
            paddingBottom: composerBottom,
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
  testID,
}: {
  title: string;
  body?: string;
  action?: { label: string; onPress: () => void };
  testID?: string;
}) {
  return (
    <View
      testID={testID}
      style={{ alignItems: 'center', gap: 6, paddingVertical: 32, paddingHorizontal: 16 }}
    >
      <Text
        accessibilityRole="header"
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
            maxWidth: 320,
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
