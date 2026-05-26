import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { CalendarClock, CheckCircle2 } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
import { CardWrapper } from './card-wrapper';
import { SectionHeader } from './section-header';

interface NextServiceDueProps {
  task: {
    id: string;
    motorcycleId: string;
    title: string;
    dueDate: string;
  } | null;
  bikeName: string;
  isDark: boolean;
  onPress: () => void;
}

function getDaysRemaining(dueDate: string): number {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const due = new Date(dueDate);
  due.setHours(0, 0, 0, 0);
  return Math.ceil((due.getTime() - now.getTime()) / 86400000);
}

function getProgressColor(days: number): string {
  if (days < 3) return palette.danger500;
  if (days <= 7) return palette.warning500;
  return palette.success500;
}

export function NextServiceDue({ task, bikeName, isDark, onPress }: NextServiceDueProps) {
  const { t, i18n } = useTranslation();

  const formatDate = (dateStr: string): string => {
    const date = new Date(dateStr);
    return date.toLocaleDateString(i18n.language, {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  };

  return (
    <Animated.View entering={FadeInUp.delay(300).duration(300)}>
      <SectionHeader
        icon={CalendarClock}
        iconColor={palette.warning500}
        title={t('home.nextService')}
        isDark={isDark}
      />

      {task == null ? (
        <CardWrapper
          tier="subtle"
          style={{
            borderWidth: 1,
            borderColor: isDark ? palette.neutral700 : palette.neutral200,
          }}
        >
          <View style={{ padding: 20, alignItems: 'center', gap: 8 }}>
            <CheckCircle2 size={36} color={palette.success500} strokeWidth={1.5} />
            <Text
              style={{
                fontSize: 14,
                color: isDark ? palette.neutral300 : palette.neutral700,
                fontWeight: '600',
                textAlign: 'center',
              }}
            >
              {t('home.allCaughtUp')}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: palette.neutral500,
                fontWeight: '500',
                textAlign: 'center',
              }}
            >
              {t('home.noUpcomingService')}
            </Text>
          </View>
        </CardWrapper>
      ) : (
        <CardWrapper tier="medium">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onPress();
            }}
            style={({ pressed }) => ({
              padding: 16,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            {(() => {
              const days = getDaysRemaining(task.dueDate);
              const progressColor = getProgressColor(days);
              const maxDays = 30;
              const progressWidth = Math.max(0.05, Math.min(1, 1 - days / maxDays));

              return (
                <>
                  <View
                    style={{
                      flexDirection: 'row',
                      justifyContent: 'space-between',
                      alignItems: 'flex-start',
                      marginBottom: 12,
                    }}
                  >
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 15,
                          fontWeight: '700',
                          color: isDark ? palette.neutral50 : palette.neutral950,
                          marginBottom: 4,
                        }}
                      >
                        {task.title}
                      </Text>
                      <Text
                        numberOfLines={1}
                        style={{
                          fontSize: 12,
                          fontWeight: '500',
                          color: palette.neutral500,
                        }}
                      >
                        {bikeName}
                      </Text>
                    </View>
                    <View style={{ alignItems: 'center' }}>
                      <Text
                        style={{
                          fontSize: 28,
                          fontWeight: '700',
                          color: progressColor,
                          fontVariant: ['tabular-nums'],
                          lineHeight: 32,
                        }}
                      >
                        {days}
                      </Text>
                      <Text
                        style={{
                          fontSize: 11,
                          fontWeight: '600',
                          color: palette.neutral500,
                        }}
                      >
                        {days === 1 ? t('home.day') : t('home.days')}
                      </Text>
                    </View>
                  </View>

                  <View
                    style={{
                      height: 6,
                      borderRadius: 3,
                      borderCurve: 'continuous',
                      backgroundColor: isDark ? palette.neutral800 : palette.neutral100,
                      overflow: 'hidden',
                      marginBottom: 8,
                    }}
                  >
                    <View
                      style={{
                        width: `${progressWidth * 100}%`,
                        height: '100%',
                        borderRadius: 3,
                        borderCurve: 'continuous',
                        backgroundColor: progressColor,
                      }}
                    />
                  </View>

                  <Text
                    style={{
                      fontSize: 12,
                      fontWeight: '500',
                      color: palette.neutral500,
                    }}
                  >
                    {t('home.dueDate', { date: formatDate(task.dueDate) })}
                  </Text>
                </>
              );
            })()}
          </Pressable>
        </CardWrapper>
      )}
    </Animated.View>
  );
}
