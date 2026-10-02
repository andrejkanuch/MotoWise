import * as Sentry from '@sentry/react-native';
import { useIsFocused, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Plus } from 'lucide-react-native';
import { useCallback, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { ADD_TASK_MODE, BIKE_SEGMENT, type BikeSegment } from '../../../lib/bike-hub/constants';
import { parseOrigin, resolveInitialSegment } from '../../../lib/bike-hub/segments';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import { useEditorialTheme } from '../../../theme/editorial';
import { showActionSheet } from '../../../utils/action-sheet';
import { OverviewSegment } from '../overview/overview-segment';
import { BikeSegment as BikeSegmentPanel } from '../segments/bike-segment';
import { CostsSegment } from '../segments/costs-segment';
import { ServiceSegment } from '../segments/service-segment';
import { ActionPill } from '../ui/action-pill';
import { BikeHeader } from '../ui/bike-header';
import { SegmentBar } from '../ui/segment-bar';
import {
  HUB_FONT,
  HUB_PILL_CLEARANCE,
  HUB_TAB_BAR_HEIGHT,
  HUB_TAB_BAR_MIN_INSET,
  HUB_TOUCH_TARGET,
  type HubCopyKey,
  hub,
} from '../ui/tokens';
import { SegmentContainer, type SegmentDefinition } from './segment-container';
import { useBikeActions } from './use-bike-actions';
import { useBikeBack } from './use-bike-back';
import { type HubBike, useBikeHubData } from './use-bike-hub-data';
import { useBikePhoto } from './use-bike-photo';

export interface BikeHubScreenProps {
  id: string;
  /** Task to expand on the Service segment (Home cards, notifications). */
  highlightTask?: string;
  /** Explicit segment to land on. */
  segment?: string;
  /** Where the screen was opened from (`BIKE_ORIGIN`); absent = the garage list. */
  from?: string;
  /** Changes on every re-navigation to an already-mounted screen. */
  ts?: string;
}

const PILL_GAP = 16;

/** Segment → its one primary action. Labelled on Overview (a chooser), icon-only elsewhere. */
const PILL: Record<BikeSegment, { labelKey?: HubCopyKey; a11yKey: HubCopyKey }> = {
  [BIKE_SEGMENT.OVERVIEW]: { labelKey: 'bikeHub.action.log', a11yKey: 'bikeHub.action.logA11y' },
  [BIKE_SEGMENT.SERVICE]: { a11yKey: 'bikeHub.action.addTaskA11y' },
  [BIKE_SEGMENT.COSTS]: { a11yKey: 'bikeHub.action.addExpenseA11y' },
  [BIKE_SEGMENT.BIKE]: { a11yKey: 'bikeHub.action.addDocumentA11y' },
};

interface Landing {
  /** Identity of the navigation that produced this landing. */
  key: string;
  highlightTaskId: string | null;
}

function landingKey({ ts, highlightTask, segment }: BikeHubScreenProps): string {
  return `${ts ?? ''}|${highlightTask ?? ''}|${segment ?? ''}`;
}

function CentredState({ children }: { children: React.ReactNode }) {
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', padding: 24, gap: 16 }}>
      {children}
    </View>
  );
}

/**
 * The bike hub: a persistent header, four segments each with its own scroll,
 * and one primary action per segment. Replaces the single-ScrollView bike
 * detail. Service / Costs / Bike wrap today's sections until R2–R5.
 */
export function BikeHubScreen(props: BikeHubScreenProps) {
  const { id, highlightTask, segment: segmentParam, from } = props;
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const isFocused = useIsFocused();
  const { t: legacyTheme } = useEditorialTheme();
  const origin = parseOrigin(from);
  const goBack = useBikeBack(origin);
  const data = useBikeHubData(id);
  const setLastSegment = useBikeHubStore((state) => state.setLastSegment);
  const collapse = useSharedValue(0);

  const resolveLanding = useCallback(
    (): BikeSegment =>
      resolveInitialSegment({
        segmentParam,
        highlightTask,
        remembered: useBikeHubStore.getState().lastSegmentByBike[id],
      }),
    [segmentParam, highlightTask, id],
  );

  const [active, setActive] = useState<BikeSegment>(resolveLanding);
  const [landing, setLanding] = useState<Landing>(() => ({
    key: landingKey(props),
    highlightTaskId: highlightTask ?? null,
  }));

  // Home re-navigates to this already-mounted screen with a fresh `_ts` (and
  // maybe another task): apply the landing rule again.
  const nextKey = landingKey(props);
  if (nextKey !== landing.key) {
    setLanding({ key: nextKey, highlightTaskId: highlightTask ?? null });
    setActive(resolveLanding());
  }

  const selectSegment = useCallback(
    (segment: BikeSegment) => {
      setActive(segment);
      setLastSegment(id, segment);
    },
    [id, setLastSegment],
  );

  const tabBarClearance = Math.max(insets.bottom, HUB_TAB_BAR_MIN_INSET) + HUB_TAB_BAR_HEIGHT;

  return (
    <View style={{ flex: 1, backgroundColor: hub.ground }}>
      {isFocused ? <StatusBar style="light" /> : null}
      <Sentry.TimeToInitialDisplay record />
      <View
        style={{
          backgroundColor: hub.ground,
          borderBottomWidth: 1,
          borderBottomColor: hub.hairline,
        }}
      >
        <BikeHeader
          bike={data.bike}
          origin={origin}
          unit={data.unit}
          collapse={collapse}
          onBack={goBack}
          onOdometerPress={() =>
            // Interim until the Odometer sheet (plan Task 6.2): the odometer is
            // edited on the Edit bike screen.
            router.push({ pathname: '/(tabs)/(garage)/edit-bike', params: { id } })
          }
        />
        {data.bike ? (
          <SegmentBar active={active} onChange={selectSegment} serviceBadge={data.serviceBadge} />
        ) : null}
      </View>

      {data.bike ? (
        <LoadedHub
          bike={data.bike}
          data={data}
          active={active}
          landing={landing}
          collapse={collapse}
          legacyBackground={legacyTheme.bg}
          bottomInset={tabBarClearance + HUB_PILL_CLEARANCE}
          pillBottom={tabBarClearance + PILL_GAP}
          onRemoved={goBack}
        />
      ) : data.isLoading ? (
        <CentredState>
          <ActivityIndicator
            size="large"
            color={hub.copper}
            accessibilityLabel={t('bikeHub.state.loadingA11y')}
          />
        </CentredState>
      ) : (
        <CentredState>
          <Text
            style={{
              fontFamily: HUB_FONT.sans,
              fontSize: 16,
              lineHeight: 22,
              color: hub.dim,
              textAlign: 'center',
            }}
          >
            {data.isError ? t('common.error') : t('bikeHub.state.notFound')}
          </Text>
          {data.isError ? (
            <Pressable
              onPress={data.retry}
              accessibilityRole="button"
              style={({ pressed }) => ({
                minHeight: HUB_TOUCH_TARGET,
                justifyContent: 'center',
                paddingHorizontal: 16,
                opacity: pressed ? 0.6 : 1,
              })}
            >
              <Text
                style={{ fontFamily: HUB_FONT.sansSemiBold, fontSize: 15, color: hub.copperText }}
              >
                {t('common.retry')}
              </Text>
            </Pressable>
          ) : null}
        </CentredState>
      )}
    </View>
  );
}

interface LoadedHubProps {
  bike: HubBike;
  data: ReturnType<typeof useBikeHubData>;
  active: BikeSegment;
  landing: Landing;
  collapse: SharedValue<number>;
  legacyBackground: string;
  bottomInset: number;
  pillBottom: number;
  onRemoved: () => void;
}

function LoadedHub({
  bike,
  data,
  active,
  landing,
  collapse,
  legacyBackground,
  bottomInset,
  pillBottom,
  onRemoved,
}: LoadedHubProps) {
  const { t } = useTranslation();
  const router = useRouter();
  const actions = useBikeActions(bike, onRemoved);
  const photo = useBikePhoto(bike.id);
  const leafParams = {
    motorcycleId: bike.id,
    bikeName: `${bike.year} ${bike.make} ${bike.model}`,
  };

  const addTask = () =>
    router.push({ pathname: '/(tabs)/(garage)/add-maintenance-task', params: leafParams });
  const logPastWork = () =>
    router.push({
      pathname: '/(tabs)/(garage)/add-maintenance-task',
      params: { ...leafParams, mode: ADD_TASK_MODE.LOG },
    });
  const addExpense = () =>
    router.push({ pathname: '/(tabs)/(garage)/add-expense', params: leafParams });
  const addDocument = () =>
    router.push({ pathname: '/(tabs)/(garage)/add-document', params: leafParams });

  // Interim chooser until the Log sheet (plan Task 6.1). Same destinations, none gated.
  const openLogChooser = () =>
    showActionSheet(t('bikeHub.action.log'), [
      { label: t('garage.addExpense', { defaultValue: 'Add Expense' }), onPress: addExpense },
      { label: t('garage.addMaintenanceTask', { defaultValue: 'Add Task' }), onPress: addTask },
      { label: t('maintenance.modeLog', { defaultValue: 'Log past work' }), onPress: logPastWork },
      { label: t('documents.addTitle', { defaultValue: 'Add Document' }), onPress: addDocument },
      { label: t('common.cancel', { defaultValue: 'Cancel' }), onPress: () => {}, style: 'cancel' },
    ]);

  const pillAction: Record<BikeSegment, () => void> = {
    [BIKE_SEGMENT.OVERVIEW]: openLogChooser,
    [BIKE_SEGMENT.SERVICE]: addTask,
    [BIKE_SEGMENT.COSTS]: addExpense,
    [BIKE_SEGMENT.BIKE]: addDocument,
  };

  const segments: Record<BikeSegment, SegmentDefinition> = {
    [BIKE_SEGMENT.OVERVIEW]: { render: () => <OverviewSegment /> },
    [BIKE_SEGMENT.SERVICE]: {
      background: legacyBackground,
      render: () => (
        <ServiceSegment
          bike={bike}
          tasks={data.tasks}
          unit={data.unit}
          highlightTaskId={landing.highlightTaskId}
          highlightKey={landing.key}
        />
      ),
    },
    [BIKE_SEGMENT.COSTS]: {
      background: legacyBackground,
      render: () => <CostsSegment bike={bike} unit={data.unit} />,
    },
    [BIKE_SEGMENT.BIKE]: {
      background: legacyBackground,
      render: () => (
        <BikeSegmentPanel
          bike={bike}
          actions={actions}
          onChangePhoto={photo.changePhoto}
          isUploadingPhoto={photo.uploading}
        />
      ),
    },
  };

  const pill = PILL[active];
  return (
    <>
      <Sentry.TimeToFullDisplay record />
      <SegmentContainer
        active={active}
        segments={segments}
        collapse={collapse}
        refreshing={data.isRefreshing}
        onRefresh={() => void data.refresh()}
        bottomInset={bottomInset}
      />
      <View style={{ position: 'absolute', right: 16, bottom: pillBottom }}>
        <ActionPill
          testID={`action-pill-${active}`}
          icon={Plus}
          label={pill.labelKey ? t(pill.labelKey) : undefined}
          accessibilityLabel={t(pill.a11yKey)}
          onPress={pillAction[active]}
        />
      </View>
    </>
  );
}
