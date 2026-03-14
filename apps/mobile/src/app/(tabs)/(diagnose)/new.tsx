import { palette } from '@motovault/design-system';
import { SubmitDiagnosticDocument } from '@motovault/graphql';
import { useQueryClient } from '@tanstack/react-query';
import * as FileSystem from 'expo-file-system';
import { useFocusEffect, useRouter } from 'expo-router';
import { ArrowLeft, X } from 'lucide-react-native';
import { useCallback, useEffect, useRef } from 'react';
import { useTranslation } from 'react-i18next';
import { AccessibilityInfo, Alert, Pressable, View } from 'react-native';
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
import { DiagnosticProgressBar } from '../../../components/diagnostic-flow/progress-bar';
import { StepBikeSelection } from '../../../components/diagnostic-flow/step-bike-selection';
import { StepPhotoDetails } from '../../../components/diagnostic-flow/step-photo-details';
import { StepProblemDescription } from '../../../components/diagnostic-flow/step-problem-description';
import { StepReviewSubmit } from '../../../components/diagnostic-flow/step-review-submit';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';
import { useDiagnosticFlowStore } from '../../../stores/diagnostic-flow.store';

const TOTAL_STEPS = 4;

export default function NewDiagnosticScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const queryClient = useQueryClient();
  const prefersReducedMotion = useReducedMotion();

  const { currentStep, navigationDirection, reset, goBack, hasAnyData } = useDiagnosticFlowStore(
    useShallow((s) => ({
      currentStep: s.currentStep,
      navigationDirection: s.navigationDirection,
      reset: s.reset,
      goBack: s.goBack,
      hasAnyData: s.hasAnyData,
    })),
  );

  const store = useDiagnosticFlowStore;

  // Reset store on focus (but not if a submission is in progress)
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

  const handleBack = () => {
    if (useDiagnosticFlowStore.getState().isSubmitting) return;
    if (currentStep > 1) {
      goBack();
      AccessibilityInfo.announceForAccessibility(
        t('diagnoseV2.stepOf', { current: currentStep - 1, total: TOTAL_STEPS }),
      );
    }
  };

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
            router.back();
          },
        },
      ]);
    } else {
      router.back();
    }
  };

  const handleSubmit = async () => {
    const state = store.getState();
    if (state.isSubmitting) return;
    state.setIsSubmitting(true);
    state.setSubmitError(null);

    try {
      // Read base64 from photoUri at submission time
      let photoBase64: string | undefined;
      if (state.photoUri) {
        photoBase64 = await FileSystem.readAsStringAsync(state.photoUri, {
          encoding: 'base64',
        });
      }

      // TODO: After `pnpm generate`, the generated types will include v2 fields natively
      const result = await gqlFetcher(SubmitDiagnosticDocument, {
        input: {
          motorcycleId: state.selectedMotorcycleId || '',
          photoBase64: photoBase64 || '',
          wizardAnswers: {
            symptoms: state.wizardAnswers.symptoms.join(','),
            location: state.wizardAnswers.location.join(','),
            timing: state.wizardAnswers.timing.join(','),
          },
          dataSharingOptedIn: state.dataSharingOptedIn,
        },
      });

      queryClient.invalidateQueries({ queryKey: queryKeys.diagnostics.all });
      router.replace(`/(diagnose)/${result.submitDiagnostic.id}` as `/${string}`);
    } catch (error) {
      state.setSubmitError(error instanceof Error ? error.message : 'Failed to analyze');
    } finally {
      state.setIsSubmitting(false);
    }
  };

  return (
    <View className="flex-1 bg-white dark:bg-neutral-900" style={{ paddingTop: insets.top }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-4 py-3">
        {currentStep > 1 ? (
          <Pressable
            className="w-10 h-10 rounded-full items-center justify-center"
            onPress={handleBack}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('diagnoseV2.back')}
          >
            <ArrowLeft size={22} color={palette.neutral600} strokeWidth={2} />
          </Pressable>
        ) : (
          <View className="w-10" />
        )}

        <View className="flex-1 mx-3">
          <DiagnosticProgressBar currentStep={currentStep} totalSteps={TOTAL_STEPS} />
        </View>

        <Pressable
          className="w-10 h-10 rounded-full items-center justify-center"
          onPress={handleClose}
          hitSlop={8}
          accessibilityRole="button"
          accessibilityLabel={t('diagnoseV2.close' as any)}
        >
          <X size={22} color={palette.neutral600} strokeWidth={2} />
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
          <StepReviewSubmit onSubmit={handleSubmit} />
        </Animated.View>
      )}
    </View>
  );
}
