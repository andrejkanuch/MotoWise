import { palette } from '@motovault/design-system';
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
import { useEditorialTheme } from '../../theme/editorial';
import { triggerImpact, triggerNotification } from '../../utils/haptics';
import { ReviewCard } from './review-card';
import {
  ANALYZING_STAGE_INTERVAL_MS,
  ANALYZING_STAGE_KEYS,
  type ReceiptReviewHandoff,
  type ReceiptReviewPayload,
  SCAN_ERROR_CODE,
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
  const { isDark } = useEditorialTheme();
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

  const bg = isDark ? palette.neutral900 : palette.neutral50;

  return (
    <View style={{ flex: 1, backgroundColor: bg, paddingHorizontal: 20, paddingTop: 12 }}>
      {renderPhase(phase, flow, isDark, onManualEntry, onClose, onSave)}
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
  isDark: boolean,
  onManualEntry: () => void,
  onClose: () => void,
  onSave: (payload: ReceiptReviewPayload) => void,
) {
  switch (phase) {
    case SCAN_PHASE.GATING:
      return <CenteredSpinner labelKey="receiptScan.gating.label" />;
    case SCAN_PHASE.BIKE_PICK:
      return <BikePickView flow={flow} isDark={isDark} />;
    case SCAN_PHASE.CONSENT:
      return <ConsentView flow={flow} isDark={isDark} onManualEntry={onManualEntry} />;
    case SCAN_PHASE.CAPTURE:
      return <CaptureView flow={flow} isDark={isDark} onManualEntry={onManualEntry} />;
    case SCAN_PHASE.UPLOADING:
      return <UploadingView attempt={flow.state.uploadAttempt} />;
    case SCAN_PHASE.OFFLINE_QUEUED:
      return <OfflineQueuedView isDark={isDark} onClose={onClose} />;
    case SCAN_PHASE.ANALYZING:
      return <AnalyzingView flow={flow} isDark={isDark} />;
    case SCAN_PHASE.REVIEW:
      return (
        <ReviewCard
          handoff={flow.state.handoff as ReceiptReviewHandoff}
          bikeName={flow.bikeName}
          bikes={flow.bikes}
          isDark={isDark}
          onPark={flow.parkForLater}
          onClose={onClose}
          onSave={onSave}
        />
      );
    case SCAN_PHASE.ERROR:
      return <ErrorView flow={flow} isDark={isDark} onManualEntry={onManualEntry} />;
    case SCAN_PHASE.PARKED:
      return <ParkedView isDark={isDark} onClose={onClose} />;
    case SCAN_PHASE.ALREADY_PROCESSED:
      return (
        <AlreadyProcessedView
          flow={flow}
          isDark={isDark}
          onManualEntry={onManualEntry}
          onClose={onClose}
        />
      );
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
        backgroundColor: disabled ? palette.neutral500 : palette.signature500,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingHorizontal: 20,
      }}
    >
      {icon}
      <Text style={{ color: palette.white, fontSize: 17, fontWeight: '700' }}>{label}</Text>
    </Pressable>
  );
}

function SecondaryButton({
  label,
  icon,
  onPress,
  isDark,
}: {
  label: string;
  icon?: ReactNode;
  onPress: () => void;
  isDark: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={{
        minHeight: TARGET_HEIGHT,
        borderRadius: 14,
        borderCurve: 'continuous',
        backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
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
          color: isDark ? palette.neutral50 : palette.neutral900,
          fontSize: 16,
          fontWeight: '600',
        }}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function Heading({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <Text
      style={{
        fontSize: 24,
        fontWeight: '800',
        color: isDark ? palette.neutral50 : palette.neutral950,
        marginBottom: 8,
      }}
    >
      {text}
    </Text>
  );
}

function Body({ text, isDark }: { text: string; isDark: boolean }) {
  return (
    <Text
      style={{
        fontSize: 16,
        lineHeight: 23,
        color: isDark ? palette.neutral300 : palette.neutral600,
        marginBottom: 20,
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
  const { isDark } = useEditorialTheme();
  return (
    <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}>
      <ActivityIndicator size="large" color={palette.signature500} />
      <Text style={{ color: isDark ? palette.neutral300 : palette.neutral600, fontSize: 16 }}>
        {t(labelKey)}
      </Text>
    </View>
  );
}

// --- Phase views ---

function BikePickView({ flow, isDark }: { flow: ScanFlow; isDark: boolean }) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <Heading text={t('receiptScan.bikePick.title')} isDark={isDark} />
      <Body text={t('receiptScan.bikePick.subtitle')} isDark={isDark} />
      <View style={{ gap: 10 }}>
        {flow.bikes.map((bike, index) => (
          <Animated.View key={bike.id} entering={FadeInUp.delay(index * 50).duration(200)}>
            <Pressable
              onPress={() => flow.selectBike(bike.id)}
              style={{
                minHeight: TARGET_HEIGHT,
                borderRadius: 14,
                borderCurve: 'continuous',
                backgroundColor: isDark ? palette.neutral800 : palette.white,
                borderWidth: 1,
                borderColor: isDark ? palette.neutral700 : palette.neutral200,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'space-between',
                paddingHorizontal: 18,
              }}
            >
              <Text
                style={{
                  fontSize: 17,
                  fontWeight: '600',
                  color: isDark ? palette.neutral50 : palette.neutral900,
                }}
              >
                {bike.name}
              </Text>
              <ChevronRight size={20} color={palette.neutral400} />
            </Pressable>
          </Animated.View>
        ))}
      </View>
    </Animated.View>
  );
}

function ConsentView({
  flow,
  isDark,
  onManualEntry,
}: {
  flow: ScanFlow;
  isDark: boolean;
  onManualEntry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 12, marginBottom: 20 }}>
        <Sparkles size={40} color={palette.signature500} />
      </View>
      <Heading text={t('receiptScan.consent.title')} isDark={isDark} />
      <Body text={t('receiptScan.consent.body')} isDark={isDark} />
      <BottomZone>
        <PrimaryButton label={t('receiptScan.consent.accept')} onPress={flow.acceptConsent} />
        <SecondaryButton
          label={t('receiptScan.common.enterManually')}
          icon={<PencilLine size={18} color={isDark ? palette.neutral50 : palette.neutral900} />}
          onPress={onManualEntry}
          isDark={isDark}
        />
      </BottomZone>
    </Animated.View>
  );
}

function CaptureView({
  flow,
  isDark,
  onManualEntry,
}: {
  flow: ScanFlow;
  isDark: boolean;
  onManualEntry: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <Heading text={t('receiptScan.capture.title')} isDark={isDark} />
      <Body text={t('receiptScan.capture.subtitle')} isDark={isDark} />
      <BottomZone>
        <PrimaryButton
          label={t('receiptScan.capture.takePhoto')}
          icon={<Camera size={20} color={palette.white} />}
          onPress={flow.captureFromCamera}
        />
        <SecondaryButton
          label={t('receiptScan.capture.chooseFromLibrary')}
          icon={<ImageIcon size={18} color={isDark ? palette.neutral50 : palette.neutral900} />}
          onPress={flow.captureFromLibrary}
          isDark={isDark}
        />
        <SecondaryButton
          label={t('receiptScan.capture.openSettings')}
          icon={<Settings size={18} color={isDark ? palette.neutral50 : palette.neutral900} />}
          onPress={() => Linking.openSettings()}
          isDark={isDark}
        />
        <SecondaryButton
          label={t('receiptScan.common.enterManually')}
          icon={<PencilLine size={18} color={isDark ? palette.neutral50 : palette.neutral900} />}
          onPress={onManualEntry}
          isDark={isDark}
        />
      </BottomZone>
    </Animated.View>
  );
}

function UploadingView({ attempt }: { attempt: number }) {
  const { t } = useTranslation();
  const { isDark } = useEditorialTheme();
  return (
    <Animated.View
      entering={FadeIn.duration(200)}
      style={{ flex: 1, alignItems: 'center', justifyContent: 'center', gap: 16 }}
    >
      <ActivityIndicator size="large" color={palette.signature500} />
      <Text
        style={{
          fontSize: 18,
          fontWeight: '600',
          color: isDark ? palette.neutral50 : palette.neutral900,
        }}
      >
        {t('receiptScan.uploading.label')}
      </Text>
      {attempt > 1 && (
        <Text style={{ fontSize: 14, color: palette.neutral400 }}>
          {t('receiptScan.uploading.retrying')}
        </Text>
      )}
    </Animated.View>
  );
}

function OfflineQueuedView({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={SlideInUp.duration(240)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
        <WifiOff size={44} color={palette.signature500} />
      </View>
      <Heading text={t('receiptScan.offline.title')} isDark={isDark} />
      <Body text={t('receiptScan.offline.body')} isDark={isDark} />
      <BottomZone>
        <PrimaryButton label={t('receiptScan.common.done')} onPress={onClose} />
      </BottomZone>
    </Animated.View>
  );
}

function AnalyzingView({ flow, isDark }: { flow: ScanFlow; isDark: boolean }) {
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
        <ActivityIndicator size="large" color={palette.signature500} />
        <Animated.Text
          key={stageIndex}
          entering={FadeIn.duration(300)}
          style={{
            fontSize: 18,
            fontWeight: '600',
            color: isDark ? palette.neutral50 : palette.neutral900,
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
              icon={
                <PencilLine size={18} color={isDark ? palette.neutral50 : palette.neutral900} />
              }
              onPress={flow.requestSkip}
              isDark={isDark}
            />
          </Animated.View>
        )}
      </BottomZone>
    </Animated.View>
  );
}

function ErrorView({
  flow,
  isDark,
  onManualEntry,
}: {
  flow: ScanFlow;
  isDark: boolean;
  onManualEntry: () => void;
}) {
  const { t } = useTranslation();
  const outcome = flow.state.error;
  if (!outcome) return null;

  // recovery → primary action dispatch (no nested if/else).
  const primary = {
    retry: {
      label: t('receiptScan.error.retry'),
      onPress:
        outcome.code === SCAN_ERROR_CODE.IMAGE_INVALID ? flow.retryUpload : flow.retryAnalyze,
    },
    manual: { label: t('receiptScan.common.enterManually'), onPress: onManualEntry },
    paywall: { label: t('receiptScan.common.enterManually'), onPress: onManualEntry },
  }[outcome.recovery];

  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 20 }}>
        <Clock size={44} color={palette.warning500} />
      </View>
      <Heading text={t(outcome.titleKey)} isDark={isDark} />
      <Body text={t(outcome.bodyKey)} isDark={isDark} />
      {outcome.noCreditUsed && (
        <View
          style={{
            alignSelf: 'flex-start',
            backgroundColor: isDark ? palette.neutral800 : palette.neutral200,
            borderRadius: 10,
            borderCurve: 'continuous',
            paddingHorizontal: 12,
            paddingVertical: 6,
            marginBottom: 8,
          }}
        >
          <Text style={{ color: palette.success500, fontSize: 14, fontWeight: '600' }}>
            {t('receiptScan.common.noCreditUsed')}
          </Text>
        </View>
      )}
      <BottomZone>
        <PrimaryButton label={primary.label} onPress={primary.onPress} />
        {outcome.recovery === 'retry' && (
          <SecondaryButton
            label={t('receiptScan.common.enterManually')}
            icon={<PencilLine size={18} color={isDark ? palette.neutral50 : palette.neutral900} />}
            onPress={onManualEntry}
            isDark={isDark}
          />
        )}
      </BottomZone>
    </Animated.View>
  );
}

function ParkedView({ isDark, onClose }: { isDark: boolean; onClose: () => void }) {
  const { t } = useTranslation();
  return (
    <Animated.View entering={SlideInUp.duration(240)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 40, marginBottom: 20 }}>
        <CheckCircle2 size={44} color={palette.success500} />
      </View>
      <Heading text={t('receiptScan.parked.title')} isDark={isDark} />
      <Body text={t('receiptScan.parked.body')} isDark={isDark} />
      <BottomZone>
        <PrimaryButton label={t('receiptScan.common.done')} onPress={onClose} />
      </BottomZone>
    </Animated.View>
  );
}

function AlreadyProcessedView({
  flow,
  isDark,
  onManualEntry,
  onClose,
}: {
  flow: ScanFlow;
  isDark: boolean;
  onManualEntry: () => void;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const handoff = flow.state.handoff;
  return (
    <Animated.View entering={FadeInUp.duration(220)} style={{ flex: 1 }}>
      <View style={{ alignItems: 'center', marginTop: 32, marginBottom: 20 }}>
        <CheckCircle2 size={44} color={palette.signature500} />
      </View>
      <Heading text={t('receiptScan.alreadyProcessed.title')} isDark={isDark} />
      <Body text={t('receiptScan.alreadyProcessed.body')} isDark={isDark} />
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
          icon={<PencilLine size={18} color={isDark ? palette.neutral50 : palette.neutral900} />}
          onPress={onManualEntry}
          isDark={isDark}
        />
      </BottomZone>
    </Animated.View>
  );
}
