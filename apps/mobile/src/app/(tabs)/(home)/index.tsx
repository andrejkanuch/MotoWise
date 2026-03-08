import { palette } from '@motolearn/design-system';
import { MeDocument, MyMotorcyclesDocument } from '@motolearn/graphql';
import { useQuery } from '@tanstack/react-query';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { useRouter } from 'expo-router';
import {
  ArrowRight,
  ChevronRight,
  CircuitBoard,
  DollarSign,
  Gauge,
  Hash,
  ScanLine,
} from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

export default function HomeScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();

  const meQuery = useQuery({
    queryKey: queryKeys.user.me,
    queryFn: () => gqlFetcher(MeDocument),
  });
  const bikesQuery = useQuery({
    queryKey: queryKeys.motorcycles.all,
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const user = meQuery.data?.me;
  const preferences = user?.preferences as
    | { onboardingCompleted?: boolean; experienceLevel?: string }
    | null
    | undefined;
  const motorcycles = bikesQuery.data?.myMotorcycles ?? [];
  const primaryBike = motorcycles.find((b: { isPrimary: boolean }) => b.isPrimary) as
    | { make: string; model: string; year: number }
    | undefined;

  const showSetupCta = !preferences?.onboardingCompleted || motorcycles.length === 0;

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View
          entering={FadeIn.duration(300)}
          className="flex-row items-center justify-between px-5 py-3"
        >
          <View className="flex-row items-center gap-2">
            <Image
              source={require('../../../assets/icon.png')}
              style={{ width: 32, height: 32, borderRadius: 8 }}
            />
            <Text className="text-lg font-bold tracking-tight text-neutral-950 dark:text-neutral-50">
              {t('common.appName').toUpperCase()}
            </Text>
          </View>
          <Pressable onPress={() => router.push('/(tabs)/(profile)')}>
            <View
              className="w-9 h-9 rounded-full bg-primary-500 items-center justify-center"
              style={{ borderCurve: 'continuous' }}
            >
              <Text className="text-white text-sm font-bold">
                {user?.fullName?.charAt(0)?.toUpperCase() ?? '?'}
              </Text>
            </View>
          </Pressable>
        </Animated.View>

        {/* Setup Rider Profile CTA */}
        {showSetupCta && (
          <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-5 mt-2">
            <Pressable
              onPress={() => router.push('/(onboarding)')}
              style={{ borderCurve: 'continuous' }}
            >
              <LinearGradient
                colors={[palette.gradientCTAStart, palette.gradientCTAEnd]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={{ borderRadius: 16, padding: 20, borderCurve: 'continuous' }}
              >
                <View className="flex-row items-center justify-between">
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center">
                      <CircuitBoard size={20} color={palette.white} strokeWidth={1.5} />
                    </View>
                    <View className="flex-1">
                      <Text className="text-white text-base font-bold">
                        {t('home.setupProfile')}
                      </Text>
                      <Text className="text-white/70 text-sm mt-0.5">
                        {t('home.setupProfileDesc')}
                      </Text>
                    </View>
                  </View>
                  <ArrowRight size={20} color={palette.white} strokeWidth={2} />
                </View>
              </LinearGradient>
            </Pressable>
          </Animated.View>
        )}

        {/* Hero Text */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-5 mt-6">
          <Text className="text-[28px] font-bold leading-tight text-neutral-950 dark:text-neutral-50">
            {t('home.heroTitle')}
          </Text>
        </Animated.View>

        {/* Bike Illustration Area */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-5 mt-5">
          <View
            className="bg-white dark:bg-neutral-800 rounded-2xl overflow-hidden"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="h-48 bg-neutral-100 dark:bg-neutral-700 items-center justify-center">
              <View className="flex-row items-end gap-8">
                <View className="items-center">
                  <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    {t('home.category.engine')}
                  </Text>
                  <View className="w-24 h-24 bg-neutral-200 dark:bg-neutral-600 rounded-xl" />
                </View>
                <View className="items-center">
                  <Text className="text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                    {t('home.category.suspension')}
                  </Text>
                  <View className="w-24 h-24 bg-neutral-200 dark:bg-neutral-600 rounded-xl" />
                </View>
              </View>
            </View>

            {/* Category Dots */}
            <View className="flex-row items-center justify-center gap-6 py-3">
              {(['engine', 'brakes', 'suspension'] as const).map((cat) => (
                <View key={cat} className="flex-row items-center gap-1.5">
                  <Text className="text-sm font-medium text-neutral-700 dark:text-neutral-300 capitalize">
                    {t(`home.category.${cat}`)}
                  </Text>
                  <View className="w-2 h-2 rounded-full bg-accent-500" />
                </View>
              ))}
            </View>
          </View>
        </Animated.View>

        {/* Spec Pills */}
        {primaryBike && (
          <Animated.View entering={FadeInUp.delay(400).duration(400)} className="px-5 mt-4">
            <View className="flex-row gap-3">
              <View
                className="flex-1 flex-row items-center gap-2 bg-white dark:bg-neutral-800 rounded-xl px-4 py-3"
                style={{ borderCurve: 'continuous' }}
              >
                <Hash size={16} color={palette.neutral400} strokeWidth={2} />
                <Text
                  selectable
                  className="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  {primaryBike.year} {primaryBike.make}
                </Text>
              </View>
              <View
                className="flex-1 flex-row items-center gap-2 bg-white dark:bg-neutral-800 rounded-xl px-4 py-3"
                style={{ borderCurve: 'continuous' }}
              >
                <DollarSign size={16} color={palette.neutral400} strokeWidth={2} />
                <Text
                  selectable
                  className="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  {primaryBike.model}
                </Text>
              </View>
            </View>
            <View className="flex-row gap-3 mt-3">
              <View
                className="flex-1 flex-row items-center gap-2 bg-white dark:bg-neutral-800 rounded-xl px-4 py-3"
                style={{ borderCurve: 'continuous' }}
              >
                <Gauge size={16} color={palette.neutral400} strokeWidth={2} />
                <Text
                  selectable
                  className="text-sm font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  {primaryBike.year}
                </Text>
              </View>
              <View
                className="flex-1 flex-row items-center gap-2 bg-white dark:bg-neutral-800 rounded-xl px-4 py-3"
                style={{ borderCurve: 'continuous' }}
              >
                <CircuitBoard size={16} color={palette.neutral400} strokeWidth={2} />
                <Text className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 capitalize">
                  {preferences?.experienceLevel ?? t('profile.rider')}
                </Text>
              </View>
            </View>
          </Animated.View>
        )}

        {/* Check Your Bike CTA */}
        <Animated.View entering={FadeInUp.delay(500).duration(400)} className="px-5 mt-5">
          <Pressable
            className="bg-white dark:bg-neutral-800 rounded-2xl p-4 flex-row items-center"
            style={{ borderCurve: 'continuous' }}
            onPress={() => router.push('/(tabs)/(diagnose)')}
          >
            <View className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-900 items-center justify-center mr-3">
              <ScanLine size={22} color={palette.primary500} strokeWidth={2} />
            </View>
            <View className="flex-1">
              <Text className="text-base font-bold text-neutral-950 dark:text-neutral-50">
                {t('home.checkBike')}
              </Text>
              <Text className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t('home.checkBikeDesc')}
              </Text>
            </View>
            <View className="w-10 h-10 rounded-full bg-primary-950 dark:bg-primary-500 items-center justify-center">
              <ChevronRight size={18} color={palette.white} strokeWidth={2.5} />
            </View>
          </Pressable>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
