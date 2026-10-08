import * as Sentry from '@sentry/react-native';
import { useIsFocused } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Plus } from 'lucide-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Keyboard, Pressable, Text, View } from 'react-native';
import { type SharedValue, useSharedValue } from 'react-native-reanimated';
import { BIKE_SEGMENT, type BikeSegment } from '../../../lib/bike-hub/constants';
import { parseOrigin, resolveInitialSegment } from '../../../lib/bike-hub/segments';
import { useBikeHubStore } from '../../../stores/bike-hub.store';
import { EDITORIAL_SCHEME, EditorialSchemeProvider } from '../../../theme/editorial';
import { OverviewSegment } from '../overview/overview-segment';
import { BikeSegment as BikeSegmentPanel } from '../segments/bike-segment';
import { CostsSegment } from '../segments/costs-segment';
import { ServiceSegment } from '../segments/service-segment';
import { ActionPill } from '../ui/action-pill';
import { BikeHeader } from '../ui/bike-header';
import { useHubBottomLayout } from '../ui/bottom-layout';
import { SegmentBar } from '../ui/segment-bar';
import { HUB_FONT, HUB_TOUCH_TARGET, type HubCopyKey, hub } from '../ui/tokens';
import { SegmentContainer, type SegmentDefinition } from './segment-container';
import { useBikeActions } from './use-bike-actions';
import { useBikeBack } from './use-bike-back';
import { type BikeHubData, type HubBike, useBikeHubData } from './use-bike-hub-data';
import { type BikeHubNavigation, useBikeHubNavigation } from './use-bike-hub-navigation';
import { useBikePhoto } from './use-bike-photo';
import { refreshToday } from './use-today';

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

/**
 * Segment → its one primary action, always labelled with what it adds ("Log"
 * on Overview opens the chooser). It is the only add trigger on each segment.
 */
const PILL: Record<BikeSegment, { labelKey: HubCopyKey; a11yKey: HubCopyKey }> = {
  [BIKE_SEGMENT.OVERVIEW]: { labelKey: 'bikeHub.action.log', a11yKey: 'bikeHub.action.logA11y' },
  [BIKE_SEGMENT.SERVICE]: {
    labelKey: 'bikeHub.action.task',
    a11yKey: 'bikeHub.action.addTaskA11y',
  },
  [BIKE_SEGMENT.COSTS]: {
    labelKey: 'bikeHub.action.expense',
    a11yKey: 'bikeHub.action.addExpenseA11y',
  },
  [BIKE_SEGMENT.BIKE]: {
    labelKey: 'bikeHub.action.document',
    a11yKey: 'bikeHub.action.addDocumentA11y',
  },
};

interface Landing {
  /** Identity of the request that produced this landing (a navigation or an Overview row). */
  key: string;
  highlightTaskId: string | null;
}

function landingKey({ ts, highlightTask, segment }: BikeHubScreenProps): string {
  return `${ts ?? ''}|${highlightTask ?? ''}|${segment ?? ''}`;
}

/**
 * The sections Service / Costs / Bike still wrap (until R2–R5) follow the
 * editorial theme; the hub is dark in both schemes, so pin them dark to sit on
 * the hub's ground instead of flipping to light panels on a light-mode phone.
 */
function LegacySegment({ children }: { children: React.ReactNode }) {
  return (
    <EditorialSchemeProvider value={EDITORIAL_SCHEME.DARK}>{children}</EditorialSchemeProvider>
  );
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
  const bottomLayout = useHubBottomLayout();
  const isFocused = useIsFocused();
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
  const [navKey, setNavKey] = useState(() => landingKey(props));
  const [landing, setLanding] = useState<Landing>(() => ({
    key: navKey,
    highlightTaskId: highlightTask ?? null,
  }));

  // Home re-navigates to this already-mounted screen with a fresh `_ts` (and
  // maybe another task): apply the landing rule again.
  const nextKey = landingKey(props);
  if (nextKey !== navKey) {
    setNavKey(nextKey);
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

  // An Overview row opens a task: show Service with it expanded (a state change).
  const openTask = useCallback(
    (taskId: string) => {
      setLanding({ key: `task|${taskId}|${Date.now()}`, highlightTaskId: taskId });
      selectSegment(BIKE_SEGMENT.SERVICE);
    },
    [selectSegment],
  );

  // Coming back to the hub (from a leaf, another tab) re-reads the date.
  useEffect(() => {
    if (isFocused) refreshToday();
  }, [isFocused]);

  // A screen pushed above this hub (Notes) asked for a task: it goes back, we show it.
  const pendingTask = useBikeHubStore((state) => state.pendingTask);
  const clearPendingTask = useBikeHubStore((state) => state.clearPendingTask);
  useEffect(() => {
    if (pendingTask?.bikeId !== id) return;
    clearPendingTask();
    openTask(pendingTask.taskId);
  }, [pendingTask, id, clearPendingTask, openTask]);

  // The header's odometer chip lives outside the loaded hub but opens one of its leaves.
  const navigationRef = useRef<BikeHubNavigation | null>(null);
  const setNavigation = useCallback((navigation: BikeHubNavigation) => {
    navigationRef.current = navigation;
  }, []);

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
          onOdometerPress={() => navigationRef.current?.openOdometerSheet()}
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
          bottomInset={bottomLayout.contentInset}
          pillBottom={bottomLayout.pillBottom}
          onRemoved={goBack}
          onShowSegment={setActive}
          onSelectSegment={selectSegment}
          onOpenTask={openTask}
          navigationRef={setNavigation}
          focused={isFocused}
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
  data: BikeHubData;
  active: BikeSegment;
  landing: Landing;
  collapse: SharedValue<number>;
  bottomInset: number;
  pillBottom: number;
  onRemoved: () => void;
  /** Show a segment without remembering it (a leaf is about to open). */
  onShowSegment: (segment: BikeSegment) => void;
  /** The rider chose a segment: show it and remember it. */
  onSelectSegment: (segment: BikeSegment) => void;
  onOpenTask: (taskId: string) => void;
  navigationRef: (navigation: BikeHubNavigation) => void;
  /** False while a leaf or sheet sits over the hub: segment gestures switch off. */
  focused: boolean;
}

function LoadedHub({
  bike,
  data,
  active,
  landing,
  collapse,
  bottomInset,
  pillBottom,
  onRemoved,
  onShowSegment,
  onSelectSegment,
  onOpenTask,
  navigationRef,
  focused,
}: LoadedHubProps) {
  const { t } = useTranslation();
  const actions = useBikeActions(bike, onRemoved);
  const photo = useBikePhoto(bike.id);
  const navigation = useBikeHubNavigation(bike, active, onShowSegment);
  useEffect(() => navigationRef(navigation), [navigationRef, navigation]);
  const keyboardVisible = useKeyboardVisible();

  const pillAction: Record<BikeSegment, () => void> = {
    [BIKE_SEGMENT.OVERVIEW]: navigation.openLogSheet,
    [BIKE_SEGMENT.SERVICE]: navigation.addTask,
    [BIKE_SEGMENT.COSTS]: navigation.addExpense,
    [BIKE_SEGMENT.BIKE]: navigation.addDocument,
  };

  const segments: Record<BikeSegment, SegmentDefinition> = {
    [BIKE_SEGMENT.OVERVIEW]: {
      render: () => (
        <OverviewSegment
          bike={bike}
          unit={data.unit}
          shell={data}
          actions={actions}
          navigation={navigation}
          photo={photo}
          onShowSegment={onSelectSegment}
          onOpenTask={onOpenTask}
        />
      ),
    },
    [BIKE_SEGMENT.SERVICE]: {
      render: () => (
        <LegacySegment>
          <ServiceSegment
            bike={bike}
            tasks={data.tasks}
            unit={data.unit}
            highlightTaskId={landing.highlightTaskId}
            highlightKey={landing.key}
          />
        </LegacySegment>
      ),
    },
    [BIKE_SEGMENT.COSTS]: {
      render: () => (
        <LegacySegment>
          <CostsSegment bike={bike} unit={data.unit} />
        </LegacySegment>
      ),
    },
    [BIKE_SEGMENT.BIKE]: {
      render: () => (
        <LegacySegment>
          <BikeSegmentPanel
            bike={bike}
            actions={actions}
            onChangePhoto={photo.changePhoto}
            isUploadingPhoto={photo.uploading}
          />
        </LegacySegment>
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
        focused={focused}
      />
      {/* Out of the way while typing a quick note. */}
      {keyboardVisible ? null : (
        <View style={{ position: 'absolute', right: 16, bottom: pillBottom }}>
          <ActionPill
            testID={`action-pill-${active}`}
            icon={Plus}
            label={t(pill.labelKey)}
            accessibilityLabel={t(pill.a11yKey)}
            onPress={pillAction[active]}
          />
        </View>
      )}
    </>
  );
}

function useKeyboardVisible(): boolean {
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const show = Keyboard.addListener('keyboardDidShow', () => setVisible(true));
    const hide = Keyboard.addListener('keyboardDidHide', () => setVisible(false));
    return () => {
      show.remove();
      hide.remove();
    };
  }, []);
  return visible;
}
