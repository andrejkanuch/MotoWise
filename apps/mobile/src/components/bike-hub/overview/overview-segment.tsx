import type { ReactNode } from 'react';
import { View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import type { AttentionItem } from '../../../lib/bike-hub/attention';
import {
  ATTENTION_KIND,
  type AttentionKind,
  BIKE_SEGMENT,
  type BikeSegment,
  type HubUnit,
  RIDE_STATUS,
} from '../../../lib/bike-hub/constants';
import type { BikeActions } from '../shell/use-bike-actions';
import type { BikeHubData, HubBike } from '../shell/use-bike-hub-data';
import type { BikeHubNavigation } from '../shell/use-bike-hub-navigation';
import { AttentionList } from './attention-list';
import { CostsCard } from './costs-card';
import { NextUp } from './next-up';
import { NotesBlock } from './notes-block';
import { PapersBikeRows } from './papers-bike-rows';
import { PhotoBand } from './photo-band';
import { RideStatusCard } from './ride-status-card';
import { SetupList } from './setup-list';
import { useOverviewData } from './use-overview-data';

const STAGGER_MS = 15;
const ENTER_MS = 200;

interface OverviewSegmentProps {
  bike: HubBike;
  unit: HubUnit;
  shell: BikeHubData;
  actions: BikeActions;
  navigation: BikeHubNavigation;
  photo: { uploading: boolean; changePhoto: () => void };
  /** Switch segment — a state change, not a navigation. */
  onShowSegment: (segment: BikeSegment) => void;
  /** Open the Service segment with this task expanded. */
  onOpenTask: (taskId: string) => void;
  /** Tests pin the date; the screen omits it. */
  now?: Date;
}

/**
 * Overview: photo band → ride status → needs attention (or the setup list on a
 * bike with nothing tracked) → next up → costs → notes → papers & bike.
 */
export function OverviewSegment({
  bike,
  unit,
  shell,
  actions,
  navigation,
  photo,
  onShowSegment,
  onOpenTask,
  now,
}: OverviewSegmentProps) {
  const data = useOverviewData(bike, shell, unit, now);
  // A verdict needs tasks and documents both loaded: until then no status, and
  // no "Set this bike up" list for a bike that may well have tasks.
  const { isLoading: statusLoading, isError: statusError } = data.statusSource;
  const statusKnown = !statusLoading && !statusError;
  const untracked = statusKnown && data.status.status === RIDE_STATUS.UNTRACKED;
  const showService = () => onShowSegment(BIKE_SEGMENT.SERVICE);
  const showBike = () => onShowSegment(BIKE_SEGMENT.BIKE);

  // D3: links to leaves that are not built yet go to today's screens.
  const openItem: { [K in AttentionKind]: (item: Extract<AttentionItem, { kind: K }>) => void } = {
    [ATTENTION_KIND.RECALL]: () => actions.checkRecalls(),
    [ATTENTION_KIND.TASK]: (item) => onOpenTask(item.id),
    [ATTENTION_KIND.DOCUMENT]: (item) => navigation.openDocument(item.id),
  };
  const onPressItem = (item: AttentionItem) =>
    (openItem[item.kind] as (item: AttentionItem) => void)(item);
  const topItem = data.attention.visible[0];

  // A block that renders nothing must not be listed at all, or its empty
  // wrapper would still take a 12 pt gap (READY: status card → costs).
  const attentionHidden =
    !untracked && !data.tasks.isLoading && !data.tasks.isError && data.attention.total === 0;
  const hidden = new Set([
    ...(attentionHidden ? ['attention'] : []),
    ...(data.nextUp ? [] : ['next-up']),
  ]);

  const allBlocks: Array<[key: string, node: ReactNode]> = [
    [
      'photo',
      <PhotoBand
        key="photo"
        photoUrl={bike.primaryPhotoUrl}
        isPrimary={bike.isPrimary}
        ridesCount={shell.ridesCount}
        uploading={photo.uploading}
        onPress={showBike}
        onAddPhoto={photo.changePhoto}
      />,
    ],
    [
      'status',
      <RideStatusCard
        key="status"
        status={data.status.status}
        reasons={data.status.reasons}
        isLoading={statusLoading}
        isError={statusError}
        onRetry={data.statusSource.refetch}
        // Read only on UNTRACKED, which already requires zero open recalls
        // (ride-status.ts) — so a known recall list is all that is left to check.
        noOpenRecalls={data.recallsKnown}
        onPress={topItem ? () => onPressItem(topItem) : undefined}
      />,
    ],
    untracked
      ? [
          'setup',
          <SetupList
            key="setup"
            make={bike.make}
            unit={unit}
            onImportSchedule={actions.importSchedule}
            isImporting={actions.isImportingSchedule}
            onLogPastWork={navigation.logPastWork}
            onAddDocument={navigation.addDocument}
          />,
        ]
      : [
          'attention',
          <AttentionList
            key="attention"
            result={data.attention}
            unit={unit}
            make={bike.make}
            isLoading={data.tasks.isLoading}
            isError={data.tasks.isError}
            onRetry={data.tasks.refetch}
            refreshFailed={data.tasks.refreshFailed}
            onPressItem={onPressItem}
            onPressAll={showService}
          />,
        ],
    [
      'next-up',
      <NextUp
        key="next-up"
        entry={data.nextUp}
        unit={unit}
        make={bike.make}
        onPress={onOpenTask}
      />,
    ],
    [
      'costs',
      <CostsCard
        key="costs"
        year={data.costs.year}
        summary={data.costs.summary}
        purchasePrice={bike.purchasePrice}
        isLoading={data.costs.isLoading}
        isError={data.costs.isError}
        onRetry={data.costs.refetch}
        refreshFailed={data.costs.refreshFailed}
        onPress={() => onShowSegment(BIKE_SEGMENT.COSTS)}
      />,
    ],
    [
      'notes',
      <NotesBlock
        key="notes"
        motorcycleId={bike.id}
        odometer={bike.currentMileage}
        unit={unit}
        notes={data.notes.items}
        isLoading={data.notes.isLoading}
        isError={data.notes.isError}
        onRetry={data.notes.refetch}
        refreshFailed={data.notes.refreshFailed}
        onOpenNotes={navigation.openNotes}
        onOpenNoteSheet={navigation.openNoteSheet}
      />,
    ],
    [
      'papers',
      <PapersBikeRows
        key="papers"
        bike={bike}
        documentSignals={data.documentSignals}
        documentCount={data.documentCount}
        onPress={showBike}
      />,
    ],
  ];

  const blocks = allBlocks.filter(([key]) => !hidden.has(key));

  return (
    <View testID="overview-segment" style={{ gap: 12, paddingTop: 12, paddingHorizontal: 16 }}>
      {blocks.map(([key, node], index) => (
        <Animated.View
          key={key}
          testID={`overview-block-${key}`}
          entering={FadeInUp.delay(index * STAGGER_MS).duration(ENTER_MS)}
        >
          {node}
        </Animated.View>
      ))}
    </View>
  );
}
