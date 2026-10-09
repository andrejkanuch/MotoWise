import * as Haptics from 'expo-haptics';
import {
  Camera,
  CheckCircle2,
  ChevronRight,
  Clock,
  ImageIcon,
  PencilLine,
  Settings,
  Sparkles,
  WifiOff,
} from 'lucide-react-native';
import { type ReactNode, useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Linking, Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp, SlideInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEditorialTheme } from '../../theme/editorial';
import { SYSTEM_WEIGHT, space, type } from '../../theme/type';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import { ReviewCard } from './review-card';
import {
  ANALYZING_STAGE_INTERVAL_MS,
  ANALYZING_STAGE_KEYS,
  type ReceiptReviewHandoff,
  type ReceiptReviewPayload,
  SCAN_PHASE,
  type ScanPhase,
  type TranslationKey,
} from './scan-flow-constants';
import type { ScanFlow } from './use-scan-flow';

/**
 * Receipt-scan flow view (U6). A phase → render dispatch drives which surface is
 * shown; there is no if/else ladder. Glove ergonomics: every bottom-zone target
 * is full-width and ≥48pt, decision text is high-contrast, and distinct haptics
 * fire on capture and extraction-done.
 */
export function ReceiptScanFlow({
  flow,
  onManualEntry,
  onClose,
  onSave = defaultReviewSave,
}: {
  flow: ScanFlow;
  onManualEntry: () => void;
  onClose: () => void;
  /**
   * Persist handler for the review card. U7d wires the real save/undo; until then
   * the default logs the confirmed payload so the flow is exercisable end-to-end.
   */
  onSave?: (payload: ReceiptReviewPayload) => void;
}) {
  const { t: theme } = useEditorialTheme();
  const insets = useSafeAreaInsets();
  const { phase } = flow.state;

  // Distinct haptics on the two key transitions (captured / extraction-done).
  const prevPhase = useRef<ScanPhase>(phase);
  useEffect(() => {
    if (prevPhase.current !== phase) {
      if (phase === SCAN_PHASE.UPLOADING) triggerImpact(Haptics.ImpactFeedbackStyle.Medium);
      if (phase === SCAN_PHASE.REVIEW)
        triggerNotification(Haptics.NotificationFeedbackType.Success);
      prevPhase.current = phase;
    }
  }, [phase]);

  return (
    <View
      style={{
        flex: 1,
        backgroundColor: theme.bg,
        paddingHorizontal: 20,
        // Clear the status bar / notch — a fixed 12 collided the "Review your
        // receipt" title with the status bar on notched devices.
        paddingTop: insets.top + 12,
      }}
    >
      {renderPhase(phase, flow, onManualEntry, onClose, onSave)}
    </View>
  );
}

/**
 * Default review persist — a deliberate no-op until U7d wires the real
 * `saveReceiptScan`/undo. The card still runs its full confirm flow (validation,
 * telemetry, haptics); only persistence is deferred.
 */
function defaultReviewSave(_payload: ReceiptReviewPayload) {}

/** Phase → surface dispatch (no if/else ladder). */
function renderPhase(
  phase: ScanPhase,
  flow: ScanFlow,
  onManualEntry: () => void,
  onClose: () => void,
  onSave: (payload: ReceiptReviewPayload) => void,
) {
  switch (phase) {
    case SCAN_PHASE.GATING:
      return <CenteredSpinner labelKey="receiptScan.gating.label" />;
    case SCAN_PHASE.BIKE_PICK:
      return <BikePickView flow={flow} />;
    case SCAN_PHASE.CONSENT:
      return <ConsentView flow={flow} onManualEntry={onManualEntry} />;
    case SCAN_PHASE.CAPTURE:
      return <CaptureView flow={flow} onManualEntry={onManualEntry} />;
    case SCAN_PHASE.UPLOADING:
      return <UploadingView attempt={flow.state.uploadAttempt} />;
    case SCAN_PHASE.OFFLINE_QUEUED:
      return <OfflineQueuedView onClose={onClose} />;
    case SCAN_PHASE.ANALYZING:
      return <AnalyzingView flow={flow} />;
    case SCAN_PHASE.REVIEW:
      return (
        <ReviewCard
          handoff={flow.state.handoff as ReceiptReviewHandoff}
          bikeName={flow.bikeName}
          bikes={flow.bikes}
          onPark={flow.parkForLater}
          onClose={onClose}
          onSave={onSave}
        />
      );
    case SCAN_PHASE.ERROR:
      return <ErrorView flow={flow} onManualEntry={onManualEntry} />;
    case SCAN_PHASE.PARKED:
      return <ParkedView onClose={onClose} />;
    case SCAN_PHASE.ALREADY_PROCESSED:
      return <AlreadyProcessedView flow={flow} onManualEntry={onManualEntry} onClose={onClose} />;
    default:
      return null;
  }
}

// --- Shared primitives (inline styles per repo convention) ---

const TARGET_HEIGHT = 52; // ≥48pt glove target

function PrimaryButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  const { t: theme } = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!disabled }}
      style={{
        minHeight: TARGET_HEIGHT,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: disabled ? theme.surface3 : theme.warm,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
      }}
    >
      {icon}
      <Text style={{ ...type.bodyStrong, color: disabled ? theme.ink3 : theme.onWarm }}>
        {label}
      </Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  icon,
  onPress,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
}) {
  const { t: theme } = useEditorialTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: TARGET_HEIGHT,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: theme.surface2,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
      }}
    >
      {icon}
      <Text
        style={{
          ...type.bodyStrong,
          color: theme.ink,
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Heading({ text }: { text: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <Text
      style={{
        ...type.sheetTitle,
        color: theme.ink,
        marginBottom: space.xs,
      }}
    >
      {text}
    </Text>
  );
}

function Body({ text }: { text: string }) {
  const { t: theme } = useEditorialTheme();
  return (
    <Text
      style={{
        ...type.body,
        color: theme.ink2,
        marginBottom: space.lg,
      }}
    >
      {text}
    </Text>
  );
}

function BottomZone({ children }: { children: ReactNode }) {
  return <View style={{ marginTop: 'auto', paddingBottom: 24, gap: 12 }}>{children}</View>;
}

function CenteredSpinner({ labelKey }: { labelKey: TranslationKey }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <ActivityIndicator size="large" color={theme.ink3} />
      <Text style={{ ...type.body, color: theme.ink2 }}>{t(labelKey)}</Text>
    </View>
  );
}

// --- Phase views ---

function BikePickView({ flow }: { flow: ScanFlow }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <Heading text={t('receiptScan.bikePick.title')} />
      <Body text={t('receiptScan.bikePick.subtitle')} />
      <View style={{ gap: 10 }}>
        {flow.bikes.map((bike, index) => (
          <Animated.View key={bike.id} entering={FadeInUp.delay(index * 50).duration(200)}>
            <Pressable
              onPress={() => flow.selectBike(bike.id)}
              style={{
                minHeight: TARGET_HEIGHT,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: theme.surface,
                borderWidth: 1,
                borderColor: theme.line,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
              }}
            >
              <Text
                style={{
                  ...type.bodyStrong,
                  color: theme.ink,
                }}
              >
                {bike.name}
              </Text>
              <ChevronRight size={20} color={theme.ink3} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function ConsentView({ flow, onManualEntry }: { flow: ScanFlow; onManualEntry: () => void }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 20 }}>
        <Sparkles size={40} color={theme.ink2} />
      </View>
      <Heading text={t('receiptScan.consent.title')} />
      <Body text={t('receiptScan.consent.body')} />
      <BottomZone>
        <PrimaryButton label={t('receiptScan.consent.accept')} onPress={flow.acceptConsent} />
        <SecondaryButton
          label={t('receiptScan.common.enterManually')}
          icon={<PencilLine size={18} color={theme.ink} />}
          onPress={onManualEntry}
        />
      </BottomZone>
    </Animated.View>
  );
}

function CaptureView({ flow, onManualEntry }: { flow: ScanFlow; onManualEntry: () => void }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <Heading text={t('receiptScan.capture.title')} />
      <Body text={t('receiptScan.capture.subtitle')} />
      <BottomZone>
        <PrimaryButton
          label={t('receiptScan.capture.takePhoto')}
          icon={<Camera size={20} color={theme.onWarm} />}
          onPress={flow.captureFromCamera}
        />
        <SecondaryButton
          label={t('receiptScan.capture.chooseFromLibrary')}
          icon={<ImageIcon size={18} color={theme.ink} />}
          onPress={flow.captureFromLibrary}
        />
        <SecondaryButton
          label={t('receiptScan.capture.openSettings')}
          icon={<Settings size={18} color={theme.ink} />}
          onPress={() => Linking.openSettings()}
        />
        <SecondaryButton
          label={t('receiptScan.common.enterManually')}
          icon={<PencilLine size={18} color={theme.ink} />}
          onPress={onManualEntry}
        />
      </BottomZone>
    </Animated.View>
  );
}

function UploadingView({ attempt }: { attempt: number }) {
  const { t } = useTranslation();
  const { t: theme } = useEditorialTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <ActivityIndicator size="large" color={theme.ink3} />
      <Text
        style={{
          ...type.bodyStrong,
          color: theme.ink,
        }}
      >
        {t('receiptScan.uploading.label')}
      </Text>
      {attempt > 1 && (
        <Text style={{ ...type.subhead, color: theme.ink3 }}>
          {t('receiptScan.uploading.retrying')}
        </Text>
      )}
    </Animated.View>
  );
}

function OfflineQueuedView({ onClose }: { onClose: () => void }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  return (
    <Animated.View entering={SlideInUp.duration(240)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
        <WifiOff size={44} color={theme.ink2} />
      </View>
      <Heading text={t('receiptScan.offline.title')} />
      <Body text={t('receiptScan.offline.body')} />
      <BottomZone>
        <PrimaryButton label={t('receiptScan.common.done')} onPress={onClose} />
      </BottomZone>
    </Animated.View>
  );
}

function AnalyzingView({ flow }: { flow: ScanFlow }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const [stageIndex, setStageIndex] = useState(0);

  // Cosmetic staged labels cycled over the single scanReceipt response (per U4).
  useEffect(() => {
    const id = setInterval(() => {
      setStageIndex((i) => Math.min(i + 1, ANALYZING_STAGE_KEYS.length - 1));
    }, ANALYZING_STAGE_INTERVAL_MS);
    return () => clearInterval(id);
  }, []);

  return (
    <Animated.View entering={FadeIn.duration(200)} style={{ flex: 1 }}>
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 18 }}>
        <ActivityIndicator size="large" color={theme.ink3} />
        <Animated.Text
          key={stageIndex}
          entering={FadeIn.duration(300)}
          style={{
            ...type.bodyStrong,
            color: theme.ink,
          }}
        >
          {t(ANALYZING_STAGE_KEYS[stageIndex])}
        </Animated.Text>
      </View>
      <BottomZone>
        {flow.state.skipVisible && (
          <Animated.View entering={FadeInUp.duration(200)}>
            <SecondaryButton
              label={t('receiptScan.analyzing.skip')}
              icon={<PencilLine size={18} color={theme.ink} />}
              onPress={flow.requestSkip}
            />
          </Animated.View>
        )}
      </BottomZone>
    </Animated.View>
  );
}

function ErrorView({ flow, onManualEntry }: { flow: ScanFlow; onManualEntry: () => void }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const outcome = flow.state.error;
  if (!outcome) return null;

  // recovery → primary action dispatch (no nested if/else).
  const primary = {
    retry: {
      label: t('receiptScan.error.retry'),
      // An upload failure retried through analyze would scan an object that was
      // never stored and dead-end on IMAGE_INVALID.
      onPress: outcome.retryFrom === 'upload' ? flow.retryUpload : flow.retryAnalyze,
    },
    manual: { label: t('receiptScan.common.enterManually'), onPress: onManualEntry },
    paywall: { label: t('receiptScan.common.enterManually'), onPress: onManualEntry },
  }[outcome.recovery];

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 20 }}>
        <Clock size={44} color={theme.dueInk} />
      </View>
      <Heading text={t(outcome.titleKey)} />
      <Body text={t(outcome.bodyKey)} />
      {outcome.noCreditUsed && (
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: theme.surface2,
            borderRadius: 10,
            borderCurve: 'continuous',
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginBottom: 8,
          }}
        >
          <Text style={{ ...type.label, ...SYSTEM_WEIGHT.semibold, color: theme.success }}>
            {t('receiptScan.common.noCreditUsed')}
          </Text>
        </View>
      )}
      <BottomZone>
        <PrimaryButton label={primary.label} onPress={primary.onPress} />
        {outcome.recovery === 'retry' && (
          <SecondaryButton
            label={t('receiptScan.common.enterManually')}
            icon={<PencilLine size={18} color={theme.ink} />}
            onPress={onManualEntry}
          />
        )}
      </BottomZone>
    </Animated.View>
  );
}

function ParkedView({ onClose }: { onClose: () => void }) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  return (
    <Animated.View entering={SlideInUp.duration(240)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
        <CheckCircle2 size={44} color={theme.success} />
      </View>
      <Heading text={t('receiptScan.parked.title')} />
      <Body text={t('receiptScan.parked.body')} />
      <BottomZone>
        <PrimaryButton label={t('receiptScan.common.done')} onPress={onClose} />
      </BottomZone>
    </Animated.View>
  );
}

function AlreadyProcessedView({
  flow,
  onManualEntry,
  onClose,
}: {
  flow: ScanFlow;
  onManualEntry: () => void;
  onClose: () => void;
}) {
  const { t: theme } = useEditorialTheme();
  const { t } = useTranslation();
  const handoff = flow.state.handoff;
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 20 }}>
        <CheckCircle2 size={44} color={theme.ink2} />
      </View>
      <Heading text={t('receiptScan.alreadyProcessed.title')} />
      <Body text={t('receiptScan.alreadyProcessed.body')} />
      <BottomZone>
        {handoff ? (
          <PrimaryButton
            label={t('receiptScan.alreadyProcessed.reviewNow')}
            onPress={flow.reviewNow}
          />
        ) : (
          <PrimaryButton label={t('receiptScan.common.done')} onPress={onClose} />
        )}
        <SecondaryButton
          label={t('receiptScan.common.enterManually')}
          icon={<PencilLine size={18} color={theme.ink} />}
          onPress={onManualEntry}
        />
      </BottomZone>
    </Animated.View>
  );
}
