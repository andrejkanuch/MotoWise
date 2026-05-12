import type { ExperienceLevel } from '@motovault/types';
import * as Haptics from 'expo-haptics';
import { useRouter } from 'expo-router';
import { Bike, ChevronLeft, Flame, Gauge } from 'lucide-react-native';
import { useEffect, useRef, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { OnboardingCard } from '../../components/onboarding/onboarding-card';
import { ONBOARDING_COLORS } from '../../components/onboarding/onboarding-colors';
import { OnboardingProgress } from '../../components/onboarding/onboarding-progress';
import { TOTAL_SCREENS } from '../../config/onboarding';
import { AnalyticsEvent, trackEvent, trackScreen } from '../../lib/analytics';
import { useOnboardingStore } from '../../stores/onboarding.store';

const AFFIRMATION_KEYS: Record<ExperienceLevel, string> = {
	beginner: 'v2AffirmBeginner',
	intermediate: 'v2AffirmIntermediate',
	advanced: 'v2AffirmAdvanced',
};

const EXPERIENCE_LEVELS = [
	{
		key: 'beginner' as ExperienceLevel,
		labelKey: 'v2ExperienceBeginner',
		descKey: 'v2ExperienceBeginnerDesc',
		icon: Bike,
		color: ONBOARDING_COLORS.success,
	},
	{
		key: 'intermediate' as ExperienceLevel,
		labelKey: 'v2ExperienceIntermediate',
		descKey: 'v2ExperienceIntermediateDesc',
		icon: Gauge,
		color: ONBOARDING_COLORS.warm,
	},
	{
		key: 'advanced' as ExperienceLevel,
		labelKey: 'v2ExperienceAdvanced',
		descKey: 'v2ExperienceAdvancedDesc',
		icon: Flame,
		color: ONBOARDING_COLORS.error,
	},
] as const;

export default function ExperienceScreen() {
	const { t } = useTranslation();
	const router = useRouter();
	const insets = useSafeAreaInsets();
	const setExperienceLevel = useOnboardingStore((s) => s.setExperienceLevel);
	const storedLevel = useOnboardingStore((s) => s.experienceLevel);
	const [selected, setSelected] = useState<ExperienceLevel | null>(storedLevel);
	const autoAdvanceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

	useEffect(() => {
		trackScreen('onboarding_experience');
		trackEvent(AnalyticsEvent.SCREEN_VIEWED, {
			screen: 'experience',
			step_index: 1,
			event_type: 'onboarding_step_viewed',
		});
	}, []);

	// Clean up timeout on unmount
	useEffect(() => {
		return () => {
			if (autoAdvanceRef.current) {
				clearTimeout(autoAdvanceRef.current);
			}
		};
	}, []);

	const handleSelect = (key: string) => {
		// Clear any pending auto-advance from a previous tap
		if (autoAdvanceRef.current) {
			clearTimeout(autoAdvanceRef.current);
			autoAdvanceRef.current = null;
		}

		if (process.env.EXPO_OS === 'ios') {
			Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
		}

		const level = key as ExperienceLevel;
		setSelected(level);
		setExperienceLevel(level);

		trackEvent(AnalyticsEvent.ONBOARDING_STEP_COMPLETED, {
			step: 'experience',
			step_index: 1,
			experience_level: key,
		});

		// Auto-advance after 700ms for visual feedback + affirmation
		autoAdvanceRef.current = setTimeout(() => {
			router.replace('/(onboarding)/goals');
		}, 700);
	};

	const handleBack = () => {
		if (autoAdvanceRef.current) {
			clearTimeout(autoAdvanceRef.current);
			autoAdvanceRef.current = null;
		}
		router.back();
	};

	return (
		<View style={{ flex: 1, backgroundColor: ONBOARDING_COLORS.background }}>
			<OnboardingProgress screenIndex={1} totalScreens={TOTAL_SCREENS} />

			{/* Back button */}
			<Pressable
				onPress={handleBack}
				hitSlop={12}
				style={{
					position: 'absolute',
					top: insets.top + 44,
					left: 16,
					zIndex: 10,
					width: 36,
					height: 36,
					borderRadius: 18,
					borderCurve: 'continuous',
					backgroundColor: ONBOARDING_COLORS.surface2,
					alignItems: 'center',
					justifyContent: 'center',
				}}
			>
				<ChevronLeft size={20} color={ONBOARDING_COLORS.textPrimary} />
			</Pressable>

			<ScrollView
				style={{ flex: 1 }}
				contentContainerStyle={{ paddingHorizontal: 24, paddingTop: 56, paddingBottom: 120 }}
				showsVerticalScrollIndicator={false}
			>
				{/* Headline */}
				<Animated.View entering={FadeInDown.duration(300)}>
					<Text
						style={{
							fontFamily: 'InstrumentSerif-Regular',
							fontSize: 36,
							lineHeight: 38,
							color: ONBOARDING_COLORS.textPrimary,
							letterSpacing: -0.7,
							marginBottom: 6,
						}}
					>
						{t('onboarding.v2ExperienceTitle')}
						{'\n'}
						<Text
							style={{
								fontFamily: 'InstrumentSerif-Italic',
								color: ONBOARDING_COLORS.warm2,
							}}
						>
							{t('onboarding.v2ExperienceTitleItalic')}
						</Text>
					</Text>
				</Animated.View>

				{/* Subtitle */}
				<Animated.Text
					entering={FadeInUp.delay(150).duration(300)}
					style={{
						fontSize: 14,
						color: ONBOARDING_COLORS.textSecondary,
						lineHeight: 20,
						marginBottom: 32,
					}}
				>
					{t('onboarding.v2ExperienceSubtitle')}
				</Animated.Text>

				{/* Cards */}
				<View style={{ gap: 16 }}>
					{EXPERIENCE_LEVELS.map((level, index) => (
						<Animated.View
							key={level.key}
							entering={FadeInUp.delay(250 + index * 100)
								.duration(300)
								.springify()
								.damping(18)}
						>
							<OnboardingCard
								value={level.key}
								icon={level.icon}
								label={t(`onboarding.${level.labelKey}`)}
								subtitle={t(`onboarding.${level.descKey}`)}
								color={level.color}
								selected={selected === level.key}
								onPress={handleSelect}
							/>

							{/* Affirmation text below selected card */}
							{selected === level.key && (
								<Animated.Text
									entering={FadeInUp.duration(250).springify().damping(18)}
									style={{
										fontSize: 13,
										color: ONBOARDING_COLORS.warm2,
										fontWeight: '500',
										marginTop: 8,
										marginLeft: 4,
									}}
								>
									{t(`onboarding.${AFFIRMATION_KEYS[level.key]}`)}
								</Animated.Text>
							)}
						</Animated.View>
					))}
				</View>
			</ScrollView>
		</View>
	);
}
