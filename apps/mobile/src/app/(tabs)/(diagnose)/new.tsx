import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Alert, BackHandler, Pressable, View } from 'react-native';
import Animated, {
  FadeIn,
  FadeInLeft,
  FadeInRight,
  FadeOut,
  FadeOutLeft,
  FadeOutRight,
  useReducedMotion,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { useDiagnosticEntryGate } from '@/components/diagnosis/use-diagnostic-entry-gate';
import { useDiagnosticColors } from '@/components/diagnostic-flow/diagnostic-colors';
import { DiagnosticProgressBar } from '@/components/diagnostic-flow/progress-bar';
import { StepBikeSelection } from '@/components/diagnostic-flow/step-bike-selection';
import { StepPhotoDetails } from '@/components/diagnostic-flow/step-photo-details';
import { StepProblemDescription } from '@/components/diagnostic-flow/step-problem-description';
import { StepReviewSubmit } from '@/components/diagnostic-flow/step-review-submit';
import { useDiagnosticSubmit } from '@/components/diagnostic-flow/use-diagnostic-submit';
import { TAB_ROUTE } from '@/config/routes';
import { useDiagnosticFlowStore } from '@/stores/diagnostic-flow.store';
import { space } from '@/theme/spacing';

const TOTAL_STEPS = 4;
const HEADER_BUTTON_SIZE = 44;
const HEADER_BUTTON_STYLE = {
  width: HEADER_BUTTON_SIZE,
  height: HEADER_BUTTON_SIZE,
  borderRadius: HEADER_BUTTON_SIZE / 2,
  alignItems: 'center',
  justifyContent: 'center',
} as const;

export default function NewDiagnosticScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const prefersReducedMotion = useReducedMotion();
  const colors = useDiagnosticColors();
  const handleSubmit = useDiagnosticSubmit();

  const { currentStep, navigationDirection, reset, goBack, hasAnyData } = useDiagnosticFlowStore(
    useShallow((s) => ({
      currentStep: s.currentStep,
      navigationDirection: s.navigationDirection,
      reset: s.reset,
      goBack: s.goBack,
      hasAnyData: s.hasAnyData,
    })),
  );

  // Reset store on focus (but not if a submission is in progress). `diagnostic_started`
  // is counted per entry instead, by useStartDiagnosis / useDiagnosticEntryGate.
  useFocusEffect(
    useCallback(() => {
      const { isSubmitting } = useDiagnosticFlowStore.getState();
      if (!isSubmitting) reset();
    }, [reset]),
  );

  // Reset isTransitioning after step change animation completes
  const transitionTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // biome-ignore lint/correctness/useExhaustiveDependencies: intentionally re-run when currentStep changes
  useEffect(() => {
    transitionTimer.current = setTimeout(() => {
      useDiagnosticFlowStore.getState().setIsTransitioning(false);
    }, 300);
    return () => {
      if (transitionTimer.current) clearTimeout(transitionTimer.current);
    };
  }, [currentStep]);

  // Animations based on direction
  const entering = prefersReducedMotion
    ? FadeIn.duration(0)
    : navigationDirection === 'forward'
      ? FadeInRight.duration(250)
      : FadeInLeft.duration(250);

  const exiting = prefersReducedMotion
    ? FadeOut.duration(0)
    : navigationDirection === 'forward'
      ? FadeOutLeft.duration(200)
      : FadeOutRight.duration(200);

  // Android hardware back button
  useEffect(() => {
    const handler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleClose();
      return true;
    });
    return () => handler.remove();
  });

  const handleBack = () => {
    if (useDiagnosticFlowStore.getState().isSubmitting) return;
    if (currentStep > 1) {
      goBack();
      AccessibilityInfo.announceForAccessibility(
        t('diagnoseV2.stepOf', { current: currentStep - 1, total: TOTAL_STEPS }),
      );
    }
  };

  const navigateBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(diagnose)/' as `/${string}`);
    }
  };

  useDiagnosticEntryGate(navigateBack);

  const handleClose = () => {
    if (useDiagnosticFlowStore.getState().isSubmitting) return;
    if (hasAnyData()) {
      Alert.alert(t('diagnoseV2.cancelTitle'), t('diagnoseV2.cancelMessage'), [
        { text: t('diagnoseV2.keepEditing'), style: 'cancel' },
        {
          text: t('diagnoseV2.discard'),
          style: 'destructive',
          onPress: () => {
            reset();
            navigateBack();
          },
        },
      ]);
    } else {
      navigateBack();
    }
  };

  // Issue 365 T08: "Done" on the limit panel. The form is cleared, so reopening
  // Diagnose starts fresh instead of on the filled review step.
  const handleLimitDone = () => {
    reset();
    router.dismissTo(TAB_ROUTE.DIAGNOSE);
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.background, paddingTop: insets.top }}>
      {/* Header */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          paddingHorizontal: space.xs,
          paddingVertical: space.xs,
        }}
      >
        {currentStep > 1 ? (
          <Pressable
            style={HEADER_BUTTON_STYLE}
            onPress={handleBack}
            hitSlop={4}
            android_ripple={{ color: colors.cardBorder, borderless: true }}
            accessibilityRole="button"
            accessibilityLabel={t('diagnoseV2.back')}
          >
            <ArrowLeft size={22} color={colors.textSecondary} strokeWidth={2} />
          </Pressable>
        ) : (
          <View style={{ width: HEADER_BUTTON_SIZE }} />
        )}

        <View style={{ flex: 1, marginHorizontal: space.sm }}>
          <DiagnosticProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </View>

        <Pressable
          style={HEADER_BUTTON_STYLE}
          onPress={handleClose}
          hitSlop={4}
          android_ripple={{ color: colors.cardBorder, borderless: true }}
          accessibilityRole="button"
          accessibilityLabel={t('diagnoseV2.close')}
        >
          <X size={22} color={colors.textSecondary} strokeWidth={2} />
        </Pressable>
      </View>

      {/* Step content — use && for entering/exiting animations */}
      {currentStep === 1 && (
        <Animated.View entering={entering} exiting={exiting} style={{ flex: 1 }}>
          <StepBikeSelection />
        </Animated.View>
      )}
      {currentStep === 2 && (
        <Animated.View entering={entering} exiting={exiting} style={{ flex: 1 }}>
          <StepProblemDescription />
        </Animated.View>
      )}
      {currentStep === 3 && (
        <Animated.View entering={entering} exiting={exiting} style={{ flex: 1 }}>
          <StepPhotoDetails />
        </Animated.View>
      )}
      {currentStep === 4 && (
        <Animated.View entering={entering} exiting={exiting} style={{ flex: 1 }}>
          <StepReviewSubmit onSubmit={handleSubmit} onLimitDone={handleLimitDone} />
        </Animated.View>
      )}
    </View>
  );
}
