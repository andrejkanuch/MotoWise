import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import type { TFunction } from 'i18next';
import { Gauge } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);

import { CardWrapper } from './card-wrapper';
import { SectionHeader } from './section-header';

interface MileageOverviewProps {
  motorcycles: Array<{
    id: string;
    make: string;
    model: string;
    nickname?: string | null;
    currentMileage?: number | null;
    mileageUnit?: string | null;
    mileageUpdatedAt?: string | null;
    isPrimary: boolean;
  }>;
  isDark: boolean;
  onBikePress: (bikeId: string) => void;
}

function formatMileage(value: number): string {
  return value.toLocaleString('en-US');
}

function getRelativeTime(dateStr: string, t: TFunction): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return t('home.justNow');
  if (diffMins < 60) return t('home.minutesAgo', { count: diffMins });
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return t('home.hoursAgo', { count: diffHours });
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return t('home.daysAgo', { count: diffDays });
  const diffMonths = Math.floor(diffDays / 30);
  return t('home.monthsAgo', { count: diffMonths });
}

function getBikeName(bike: { make: string; model: string; nickname?: string | null }): string {
  return bike.nickname ?? `${bike.make} ${bike.model}`;
}

function MileageUpdatedRow({ dateStr, t }: { dateStr: string; t: TFunction }) {
  const isStale = Date.now() - new Date(dateStr).getTime() > 7 * 24 * 60 * 60 * 1000;
  return (
    <View
      style={{
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 4,
      }}
    >
      <Text
        style={{
          fontSize: 12,
          color: isStale ? palette.warning500 : palette.neutral400,
          fontWeight: '500',
        }}
      >
        {t('home.updatedAgo', { time: getRelativeTime(dateStr, t) })}
      </Text>
      {isStale && (
        <Text
          style={{
            fontSize: 12,
            color: palette.primary500,
            fontWeight: '600',
          }}
        >
          {t('home.tapToUpdate')}
        </Text>
      )}
    </View>
  );
}

export function MileageOverview({ motorcycles, isDark, onBikePress }: MileageOverviewProps) {
  const { t } = useTranslation();
  const hasMileage = motorcycles.some((m) => m.currentMileage != null);
  const isMultiBike = motorcycles.length > 1;
  const scale = useSharedValue(1);
  const pressStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(300)}>
      <SectionHeader
        icon={Gauge}
        iconColor={palette.primary500}
        title={t('home.mileage')}
        isDark={isDark}
      />

      {!hasMileage ? (
        <CardWrapper
          tier="subtle"
          style={{
            borderWidth: 1,
            borderColor: isDark ? palette.neutral700 : palette.neutral200,
          }}
        >
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              if (motorcycles.length > 0) onBikePress(motorcycles[0].id);
            }}
            style={{ padding: 20, alignItems: 'center', gap: 8 }}
          >
            <Gauge size={36} color={palette.neutral400} strokeWidth={1.5} />
            <Text
              style={{
                fontSize: 14,
                color: palette.neutral500,
                fontWeight: '500',
                textAlign: 'center',
              }}
            >
              {t('home.noMileageRecorded')}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: palette.primary500,
                fontWeight: '600',
              }}
            >
              {t('home.tapToUpdate')}
            </Text>
          </Pressable>
        </CardWrapper>
      ) : isMultiBike ? (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{ gap: 10 }}
        >
          {motorcycles.map((bike) => (
            <CardWrapper key={bike.id} tier="medium" style={{ width: 160 }}>
              <Pressable
                onPress={() => {
                  Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                  onBikePress(bike.id);
                }}
                style={({ pressed }) => ({
                  padding: 14,
                  transform: [{ scale: pressed ? 0.97 : 1 }],
                })}
              >
                <Text
                  numberOfLines={1}
                  style={{
                    fontSize: 13,
                    fontWeight: '600',
                    color: isDark ? palette.neutral300 : palette.neutral600,
                    marginBottom: 6,
                  }}
                >
                  {getBikeName(bike)}
                </Text>
                {bike.currentMileage != null ? (
                  <>
                    <Text
                      style={{
                        fontSize: 22,
                        fontWeight: '700',
                        color: isDark ? palette.neutral50 : palette.neutral950,
                        fontVariant: ['tabular-nums'],
                      }}
                    >
                      {formatMileage(bike.currentMileage)}
                    </Text>
                    <Text
                      style={{
                        fontSize: 12,
                        color: palette.neutral500,
                        fontWeight: '500',
                        marginTop: 2,
                      }}
                    >
                      {bike.mileageUnit ?? 'km'}
                    </Text>
                  </>
                ) : (
                  <Text
                    style={{
                      fontSize: 13,
                      color: palette.neutral400,
                      fontWeight: '500',
                    }}
                  >
                    {t('home.notRecorded')}
                  </Text>
                )}
              </Pressable>
            </CardWrapper>
          ))}
        </ScrollView>
      ) : (
        <CardWrapper tier="medium">
          <AnimatedPressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBikePress(motorcycles[0].id);
            }}
            onPressIn={() => {
              scale.value = withSpring(0.97, { damping: 15, stiffness: 150 });
            }}
            onPressOut={() => {
              scale.value = withSpring(1, { damping: 15, stiffness: 150 });
            }}
            style={[{ padding: 20 }, pressStyle]}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text
                style={{
                  fontSize: 34,
                  fontWeight: '700',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatMileage(motorcycles[0].currentMileage ?? 0)}
              </Text>
              <Text
                style={{
                  fontSize: 14,
                  color: palette.neutral500,
                  fontWeight: '500',
                }}
              >
                {motorcycles[0].mileageUnit ?? 'km'}
              </Text>
            </View>
            {motorcycles[0].mileageUpdatedAt && (
              <MileageUpdatedRow dateStr={motorcycles[0].mileageUpdatedAt} t={t} />
            )}
          </AnimatedPressable>
        </CardWrapper>
      )}
    </Animated.View>
  );
}
