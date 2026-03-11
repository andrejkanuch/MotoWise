import { palette } from '@motolearn/design-system';
import { LinearGradient } from 'expo-linear-gradient';
import { ChevronRight } from 'lucide-react-native';
import { useEffect } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, {
  FadeInUp,
  useAnimatedProps,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { CardWrapper } from './card-wrapper';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

function getScoreColor(score: number): string {
  if (score >= 75) return palette.success500;
  if (score >= 60) return '#EAB308';
  if (score >= 40) return palette.warning500;
  return palette.danger500;
}

const SCORE_LABEL_KEYS = {
  excellent: 'home.healthExcellent',
  good: 'home.healthGood',
  fair: 'home.healthFair',
  poor: 'home.healthPoor',
} as const;

function getScoreLabelKey(score: number): string {
  if (score >= 90) return SCORE_LABEL_KEYS.excellent;
  if (score >= 75) return SCORE_LABEL_KEYS.good;
  if (score >= 60) return SCORE_LABEL_KEYS.fair;
  return SCORE_LABEL_KEYS.poor;
}

interface FleetHealthHeroProps {
  score: number;
  hasData: boolean;
  bikeCount: number;
  singleBikeName?: string;
  needsAttention: number;
  totalOverdue: number;
  upcomingTasks: number;
  onPress: () => void;
}

export function FleetHealthHero({
  score,
  hasData,
  bikeCount,
  singleBikeName,
  needsAttention,
  totalOverdue,
  upcomingTasks,
  onPress,
}: FleetHealthHeroProps) {
  const { t } = useTranslation();
  const ringSize = 120;
  const strokeWidth = 10;
  const radius = (ringSize - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;

  const progress = useSharedValue(0);
  const glowOpacity = useSharedValue(0.1);

  useEffect(() => {
    progress.value = withSpring(hasData ? score / 100 : 0, { damping: 15, stiffness: 90 });
    glowOpacity.value = withRepeat(withTiming(0.3, { duration: 2000 }), -1, true);
  }, [score, hasData, progress, glowOpacity]);

  const animatedProps = useAnimatedProps(() => ({
    strokeDashoffset: circumference * (1 - progress.value),
  }));

  const glowStyle = useAnimatedStyle(() => ({
    opacity: glowOpacity.value,
  }));

  const color = getScoreColor(score);

  const statPills = [
    totalOverdue > 0 && {
      label: t('home.fleetHealthOverdue', { count: totalOverdue }),
      color: palette.danger500,
    },
    upcomingTasks > 0 && {
      label: t('home.fleetHealthUrgent', { count: upcomingTasks }),
      color: palette.warning500,
    },
    bikeCount > 1 && {
      label: t('home.fleetHealthBikes', { count: bikeCount }),
      color: palette.primary300,
    },
  ].filter(Boolean) as { label: string; color: string }[];

  return (
    <Animated.View entering={FadeInUp.delay(50).duration(300)}>
      <CardWrapper tier="prominent" borderRadius={24} style={{ overflow: 'hidden' }}>
        <Pressable onPress={onPress}>
          <LinearGradient
            colors={[palette.gradientHeroStart, palette.gradientHeroMid, palette.gradientHeroEnd]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              padding: 20,
              minHeight: 180,
            }}
          >
            {/* Ring with glow */}
            <View style={{ alignItems: 'center', justifyContent: 'center', marginRight: 20 }}>
              <Animated.View
                style={[
                  {
                    position: 'absolute',
                    width: ringSize + 20,
                    height: ringSize + 20,
                    borderRadius: (ringSize + 20) / 2,
                    backgroundColor: color,
                  },
                  glowStyle,
                ]}
              />
              <View
                style={{
                  width: ringSize,
                  height: ringSize,
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <Svg width={ringSize} height={ringSize}>
                  <Circle
                    cx={ringSize / 2}
                    cy={ringSize / 2}
                    r={radius}
                    stroke="rgba(255,255,255,0.15)"
                    strokeWidth={strokeWidth}
                    fill="none"
                  />
                  {hasData && (
                    <AnimatedCircle
                      cx={ringSize / 2}
                      cy={ringSize / 2}
                      r={radius}
                      stroke={color}
                      strokeWidth={strokeWidth}
                      fill="none"
                      strokeLinecap="round"
                      strokeDasharray={circumference}
                      animatedProps={animatedProps}
                      transform={`rotate(-90 ${ringSize / 2} ${ringSize / 2})`}
                    />
                  )}
                </Svg>
                <View style={{ position: 'absolute', alignItems: 'center' }}>
                  {hasData ? (
                    <>
                      <Text style={{ fontSize: 36, fontWeight: '800', color: palette.white }}>
                        {score}
                      </Text>
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: '600',
                          color,
                          marginTop: -4,
                        }}
                      >
                        {t(getScoreLabelKey(score) as never)}
                      </Text>
                    </>
                  ) : (
                    <Text
                      style={{ fontSize: 14, fontWeight: '600', color: 'rgba(255,255,255,0.5)' }}
                    >
                      {t('home.noData')}
                    </Text>
                  )}
                </View>
              </View>
            </View>

            {/* Right side info */}
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 18, fontWeight: '700', color: palette.white }}>
                {bikeCount === 1 ? t('home.fleetHealthSingle') : t('home.fleetHealthTitle')}
              </Text>
              <Text
                style={{
                  fontSize: 13,
                  color: 'rgba(255,255,255,0.7)',
                  marginTop: 4,
                }}
                numberOfLines={1}
              >
                {bikeCount === 1
                  ? singleBikeName
                  : t('home.fleetHealthStats', {
                      bikes: bikeCount,
                      attention: needsAttention,
                      upcoming: upcomingTasks,
                    })}
              </Text>

              {/* Stat pills */}
              {statPills.length > 0 && (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
                  {statPills.map((pill) => (
                    <View
                      key={pill.label}
                      style={{
                        backgroundColor: 'rgba(255,255,255,0.15)',
                        borderRadius: 999,
                        paddingHorizontal: 10,
                        paddingVertical: 4,
                      }}
                    >
                      <Text style={{ fontSize: 11, fontWeight: '700', color: pill.color }}>
                        {pill.label}
                      </Text>
                    </View>
                  ))}
                </View>
              )}
            </View>

            <ChevronRight
              size={18}
              color="rgba(255,255,255,0.6)"
              strokeWidth={2}
              style={{ marginLeft: 4 }}
            />
          </LinearGradient>
        </Pressable>
      </CardWrapper>
    </Animated.View>
  );
}
