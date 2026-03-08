import { palette } from '@motolearn/design-system';
import { MyProgressDocument } from '@motolearn/graphql';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { BookOpen, Cog, Search, Sparkles, Wrench, Zap } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { gqlFetcher } from '../../../lib/graphql-client';
import { queryKeys } from '../../../lib/query-keys';

const MODULES = [
  { key: 'engine', icon: Cog, color: palette.moduleEngine, lessons: 12, category: 'engine-basics' },
  {
    key: 'suspension',
    icon: Sparkles,
    color: palette.moduleSuspension,
    lessons: 8,
    category: 'suspension',
  },
  {
    key: 'electrical',
    icon: Zap,
    color: palette.moduleElectrical,
    lessons: 10,
    category: 'electrical',
  },
  {
    key: 'maintenance',
    icon: Wrench,
    color: palette.moduleMaintenance,
    lessons: 15,
    category: 'maintenance',
  },
] as const;

export default function LearnScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [searchQuery, setSearchQuery] = useState('');

  const { data: progressData } = useQuery({
    queryKey: queryKeys.progress.all,
    queryFn: () => gqlFetcher(MyProgressDocument),
  });
  const progress = progressData?.myProgress ?? [];
  const totalRead = useMemo(
    () => progress.filter((p: { articleRead: boolean }) => p.articleRead).length,
    [progress],
  );

  return (
    <View className="flex-1 bg-neutral-50 dark:bg-neutral-900">
      <ScrollView
        className="flex-1"
        contentContainerStyle={{ paddingBottom: 100, paddingTop: insets.top }}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <Animated.View entering={FadeIn.duration(300)} className="px-5 pt-3 pb-1">
          <Text className="text-2xl font-bold text-neutral-950 dark:text-neutral-50">
            {t('tabs.learn')}
          </Text>
        </Animated.View>

        {/* Search Bar */}
        <Animated.View entering={FadeInUp.delay(100).duration(400)} className="px-5 mt-3">
          <View
            className="flex-row items-center bg-white dark:bg-neutral-800 rounded-xl px-4 py-3 gap-2"
            style={{ borderCurve: 'continuous' }}
          >
            <Search size={18} color={palette.neutral400} strokeWidth={2} />
            <TextInput
              className="flex-1 text-base text-neutral-950 dark:text-neutral-50"
              placeholder={t('learn.searchPlaceholder')}
              placeholderTextColor={palette.neutral400}
              value={searchQuery}
              onChangeText={setSearchQuery}
              returnKeyType="search"
            />
          </View>
        </Animated.View>

        {/* Progress Card */}
        <Animated.View entering={FadeInUp.delay(200).duration(400)} className="px-5 mt-4">
          <View
            className="bg-primary-950 dark:bg-primary-800 rounded-2xl p-5 overflow-hidden"
            style={{ borderCurve: 'continuous' }}
          >
            <View className="flex-row items-center gap-3 mb-3">
              <View className="w-10 h-10 rounded-xl bg-white/15 items-center justify-center">
                <BookOpen size={20} color={palette.white} strokeWidth={2} />
              </View>
              <View className="flex-1">
                <Text className="text-white text-lg font-bold">{t('learn.motorcycleBasics')}</Text>
                <Text className="text-white/60 text-sm">
                  {t('learn.articlesRead', { count: totalRead })}
                </Text>
              </View>
            </View>

            {/* Progress Bar */}
            <View className="h-2 bg-white/15 rounded-full overflow-hidden">
              <View
                className="h-full bg-accent-400 rounded-full"
                style={{ width: `${Math.min((totalRead / 20) * 100, 100)}%` }}
              />
            </View>
            <Text className="text-white/50 text-xs mt-2" style={{ fontVariant: ['tabular-nums'] }}>
              {t('learn.progressLabel', { current: totalRead, total: 20 })}
            </Text>
          </View>
        </Animated.View>

        {/* Module Grid */}
        <Animated.View entering={FadeInUp.delay(300).duration(400)} className="px-5 mt-5">
          <Text className="text-lg font-bold text-neutral-950 dark:text-neutral-50 mb-3">
            {t('learn.modules')}
          </Text>
          <View className="flex-row flex-wrap gap-3">
            {MODULES.map((mod, index) => {
              const Icon = mod.icon;
              return (
                <Animated.View
                  key={mod.key}
                  entering={FadeInUp.delay(350 + index * 60).duration(400)}
                  style={{ width: '48%' }}
                >
                  <Pressable
                    className="bg-white dark:bg-neutral-800 rounded-2xl p-4"
                    style={{ borderCurve: 'continuous' }}
                    onPress={() =>
                      router.push(`/(tabs)/(learn)/article/${mod.category}` as `/${string}`)
                    }
                  >
                    <View
                      style={{
                        width: 44,
                        height: 44,
                        borderRadius: 12,
                        backgroundColor: `${mod.color}15`,
                        alignItems: 'center',
                        justifyContent: 'center',
                        borderCurve: 'continuous',
                      }}
                    >
                      <Icon size={22} color={mod.color} strokeWidth={2} />
                    </View>
                    <Text className="text-base font-semibold text-neutral-950 dark:text-neutral-50 mt-3 capitalize">
                      {t(`learn.module.${mod.key}`)}
                    </Text>
                    <Text className="text-xs text-neutral-500 dark:text-neutral-400 mt-1">
                      {t('learn.lessonsCount', { count: mod.lessons })}
                    </Text>
                  </Pressable>
                </Animated.View>
              );
            })}
          </View>
        </Animated.View>
      </ScrollView>
    </View>
  );
}
