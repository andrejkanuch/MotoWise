import { palette } from '@motovault/design-system';
import { MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Bike, Pencil, Sparkles } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Image, Pressable, ScrollView, Switch, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useShallow } from 'zustand/react/shallow';
import { gqlFetcher } from '../../lib/graphql-client';
import { queryKeys } from '../../lib/query-keys';
import type { Step } from '../../stores/diagnostic-flow.store';
import {
  PREDEFINED_LOCATION,
  PREDEFINED_SYMPTOMS,
  PREDEFINED_TIMING,
  useDiagnosticFlowStore,
} from '../../stores/diagnostic-flow.store';
import { DIAGNOSTIC_COLORS } from './diagnostic-colors';

const ALL_PREDEFINED = new Set<string>([
  ...PREDEFINED_SYMPTOMS,
  ...PREDEFINED_LOCATION,
  ...PREDEFINED_TIMING,
]);

interface StepReviewSubmitProps {
  onSubmit: () => void;
}

function ReviewCard({
  title,
  onEdit,
  children,
  delay = 0,
}: {
  title: string;
  onEdit: () => void;
  children: React.ReactNode;
  delay?: number;
}) {
  const { t } = useTranslation();
  return (
    <Animated.View
      entering={FadeInUp.delay(delay).duration(300)}
      style={{ marginHorizontal: 20, marginBottom: 12 }}
    >
      <View
        style={{
          backgroundColor: DIAGNOSTIC_COLORS.cardBg,
          borderRadius: 16,
          padding: 16,
          borderWidth: 1,
          borderColor: DIAGNOSTIC_COLORS.cardBorder,
          borderCurve: 'continuous',
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 8,
          }}
        >
          <Text
            style={{
              fontSize: 14,
              fontWeight: '600',
              color: DIAGNOSTIC_COLORS.textMuted,
              textTransform: 'uppercase',
              letterSpacing: 0.5,
            }}
          >
            {title}
          </Text>
          <Pressable
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 4,
              paddingVertical: 4,
              paddingHorizontal: 8,
            }}
            onPress={onEdit}
            hitSlop={8}
          >
            <Pencil size={14} color={DIAGNOSTIC_COLORS.accent} strokeWidth={2} />
            <Text style={{ fontSize: 12, fontWeight: '500', color: DIAGNOSTIC_COLORS.accent }}>
              {t('diagnoseV2.edit')}
            </Text>
          </Pressable>
        </View>
        {children}
      </View>
    </Animated.View>
  );
}

export function StepReviewSubmit({ onSubmit }: StepReviewSubmitProps) {
  const { t } = useTranslation();
  const insets = useSafeAreaInsets();

  const store = useDiagnosticFlowStore(
    useShallow((s) => ({
      selectedMotorcycleId: s.selectedMotorcycleId,
      manualBikeInfo: s.manualBikeInfo,
      inputMode: s.inputMode,
      wizardAnswers: s.wizardAnswers,
      freeTextDescription: s.freeTextDescription,
      photoUri: s.photoUri,
      additionalNotes: s.additionalNotes,
      urgency: s.urgency,
      dataSharingOptedIn: s.dataSharingOptedIn,
      isSubmitting: s.isSubmitting,
      submitError: s.submitError,
      goToStepFromReview: s.goToStepFromReview,
      setDataSharingOptedIn: s.setDataSharingOptedIn,
    })),
  );

  const { data: motorcyclesData } = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });
  const motorcycles = motorcyclesData?.myMotorcycles ?? [];
  const selectedBike = motorcycles.find((m) => m.id === store.selectedMotorcycleId);

  const editStep = (step: Step) => store.goToStepFromReview(step);

  const urgencyLabels: Record<string, string> = {
    stranded: t('diagnoseV2.urgencyStranded'),
    soon: t('diagnoseV2.urgencySoon'),
    preventive: t('diagnoseV2.urgencyPreventive'),
  };

  const wizardTags = Object.entries(store.wizardAnswers)
    .flatMap(([, values]) => (values as string[]).filter((v: string) => v !== 'dont_know'))
    .map((v: string) =>
      // biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key from wizard answers
      ALL_PREDEFINED.has(v) ? (t(`diagnoseV2.option.${v}` as any) as string) : `"${v}"`,
    );

  return (
    <View style={{ flex: 1 }}>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ paddingBottom: insets.bottom + 120 }}
        showsVerticalScrollIndicator={false}
      >
        {/* Step header */}
        <View style={{ paddingHorizontal: 24, paddingTop: 8, marginBottom: 24 }}>
          <Text
            style={{
              fontSize: 12,
              fontWeight: '600',
              textTransform: 'uppercase',
              letterSpacing: 1,
              color: DIAGNOSTIC_COLORS.textMuted,
            }}
          >
            {t('diagnoseV2.stepOf', { current: 4, total: 4 })}
          </Text>
          <Text
            style={{
              fontSize: 24,
              fontWeight: '600',
              color: DIAGNOSTIC_COLORS.textPrimary,
              marginTop: 4,
            }}
          >
            {t('diagnoseV2.review')}
          </Text>
          <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textMuted, marginTop: 4 }}>
            {/* biome-ignore lint/suspicious/noExplicitAny: dynamic i18n key from diagnose v2 */}
            {t('diagnoseV2.reviewHint' as any)}
          </Text>
        </View>

        {/* Bike */}
        <ReviewCard title={t('diagnoseV2.reviewBike')} onEdit={() => editStep(1)} delay={0}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
            {selectedBike?.primaryPhotoUrl ? (
              <Image
                source={{ uri: selectedBike.primaryPhotoUrl }}
                style={{ width: 40, height: 40, borderRadius: 8 }}
              />
            ) : (
              <View
                style={{
                  width: 40,
                  height: 40,
                  borderRadius: 8,
                  backgroundColor: 'rgba(255,255,255,0.08)',
                  alignItems: 'center',
                  justifyContent: 'center',
                  borderCurve: 'continuous',
                }}
              >
                <Bike size={18} color={DIAGNOSTIC_COLORS.textMuted} strokeWidth={1.5} />
              </View>
            )}
            <Text
              style={{
                fontSize: 16,
                color: DIAGNOSTIC_COLORS.textPrimary,
                fontWeight: '500',
              }}
            >
              {selectedBike
                ? selectedBike.nickname || `${selectedBike.make} ${selectedBike.model}`
                : store.manualBikeInfo
                  ? t('diagnoseV2.unknownBikeType', { type: store.manualBikeInfo.type })
                  : '\u2014'}
            </Text>
          </View>
        </ReviewCard>

        {/* Problem */}
        <ReviewCard title={t('diagnoseV2.reviewProblem')} onEdit={() => editStep(2)} delay={50}>
          {store.inputMode === 'wizard' ? (
            wizardTags.length > 0 ? (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                {wizardTags.map((tag) => (
                  <View
                    key={tag}
                    style={{
                      backgroundColor: DIAGNOSTIC_COLORS.accentBg,
                      borderRadius: 8,
                      paddingHorizontal: 12,
                      paddingVertical: 4,
                      borderCurve: 'continuous',
                    }}
                  >
                    <Text
                      style={{
                        fontSize: 12,
                        fontWeight: '500',
                        color: DIAGNOSTIC_COLORS.accent,
                      }}
                    >
                      {tag}
                    </Text>
                  </View>
                ))}
              </View>
            ) : (
              <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textMuted }}>
                {t('diagnoseV2.notSureTag')}
              </Text>
            )
          ) : (
            <Text
              style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textSecondary }}
              numberOfLines={3}
            >
              {store.freeTextDescription || '\u2014'}
            </Text>
          )}
        </ReviewCard>

        {/* Photo */}
        <ReviewCard title={t('diagnoseV2.reviewPhoto')} onEdit={() => editStep(3)} delay={100}>
          {store.photoUri ? (
            <Image
              source={{ uri: store.photoUri }}
              style={{ width: '100%', height: 120, borderRadius: 12 }}
              resizeMode="cover"
            />
          ) : (
            <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textMuted }}>
              {t('diagnoseV2.reviewNoPhoto')}
            </Text>
          )}
        </ReviewCard>

        {/* Notes */}
        {store.additionalNotes.trim() && (
          <ReviewCard title={t('diagnoseV2.reviewDetails')} onEdit={() => editStep(3)} delay={150}>
            <Text
              style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textSecondary }}
              numberOfLines={2}
            >
              {store.additionalNotes}
            </Text>
          </ReviewCard>
        )}

        {/* Urgency */}
        <ReviewCard title={t('diagnoseV2.reviewUrgency')} onEdit={() => editStep(3)} delay={200}>
          <Text style={{ fontSize: 14, color: DIAGNOSTIC_COLORS.textSecondary }}>
            {store.urgency ? urgencyLabels[store.urgency] : t('diagnoseV2.reviewNoUrgency')}
          </Text>
        </ReviewCard>

        {/* Data sharing toggle */}
        <Animated.View
          entering={FadeInUp.delay(250).duration(300)}
          style={{
            marginHorizontal: 20,
            marginTop: 8,
            flexDirection: 'row',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <Text
            style={{
              fontSize: 14,
              color: DIAGNOSTIC_COLORS.textSecondary,
              flex: 1,
              marginRight: 12,
            }}
          >
            {t('diagnoseV2.dataSharingLabel')}
          </Text>
          <Switch
            value={store.dataSharingOptedIn}
            onValueChange={store.setDataSharingOptedIn}
            trackColor={{ false: 'rgba(255,255,255,0.1)', true: DIAGNOSTIC_COLORS.accent }}
          />
        </Animated.View>

        {/* Disclaimer */}
        <Animated.View
          entering={FadeInUp.delay(300).duration(300)}
          style={{ marginHorizontal: 20, marginTop: 16 }}
        >
          <Text
            style={{
              fontSize: 12,
              color: DIAGNOSTIC_COLORS.textMuted,
              textAlign: 'center',
              lineHeight: 16,
            }}
          >
            {t('diagnoseV2.disclaimer')}
          </Text>
        </Animated.View>
      </ScrollView>

      {/* Gradient fade overlay */}
      <LinearGradient
        colors={['rgba(15,23,42,0)', 'rgba(15,23,42,1)']}
        style={{
          position: 'absolute',
          bottom: insets.bottom + 12 + 56 + 12,
          left: 0,
          right: 0,
          height: 40,
          pointerEvents: 'none',
        }}
      />

      {/* Submit button */}
      <View
        style={{
          position: 'absolute',
          bottom: 0,
          left: 0,
          right: 0,
          borderTopWidth: 1,
          borderTopColor: DIAGNOSTIC_COLORS.cardBorder,
          paddingHorizontal: 20,
          paddingBottom: insets.bottom + 12,
          paddingTop: 12,
          backgroundColor: DIAGNOSTIC_COLORS.background,
        }}
      >
        {store.submitError && (
          <Text
            style={{
              fontSize: 14,
              color: palette.danger500,
              textAlign: 'center',
              marginBottom: 8,
            }}
          >
            {t('diagnoseV2.submitError')}
          </Text>
        )}
        <Pressable
          style={{
            borderRadius: 16,
            paddingVertical: 16,
            alignItems: 'center',
            flexDirection: 'row',
            justifyContent: 'center',
            gap: 8,
            backgroundColor: store.isSubmitting
              ? 'rgba(129,140,248,0.7)'
              : DIAGNOSTIC_COLORS.accent,
            borderCurve: 'continuous',
          }}
          onPress={onSubmit}
          disabled={store.isSubmitting}
        >
          {store.isSubmitting ? (
            <>
              <ActivityIndicator size="small" color={palette.white} />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                {t('diagnoseV2.analyzing')}
              </Text>
            </>
          ) : store.submitError ? (
            <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
              {t('diagnoseV2.tryAgain')}
            </Text>
          ) : (
            <>
              <Sparkles size={18} color={palette.white} strokeWidth={2} />
              <Text style={{ color: '#FFFFFF', fontWeight: '600', fontSize: 16 }}>
                {t('diagnoseV2.analyze')}
              </Text>
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
