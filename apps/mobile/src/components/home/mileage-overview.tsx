import { palette } from '@motovault/design-system';
import * as Haptics from 'expo-haptics';
import { Gauge } from 'lucide-react-native';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Animated, { FadeInUp } from 'react-native-reanimated';
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

function getRelativeTime(dateStr: string): string {
  const now = Date.now();
  const then = new Date(dateStr).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 1) return 'Just now'; // TODO: i18n
  if (diffMins < 60) return `${diffMins}m ago`; // TODO: i18n
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return `${diffHours}h ago`; // TODO: i18n
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays < 30) return `${diffDays}d ago`; // TODO: i18n
  const diffMonths = Math.floor(diffDays / 30);
  return `${diffMonths}mo ago`; // TODO: i18n
}

function getBikeName(bike: { make: string; model: string; nickname?: string | null }): string {
  return bike.nickname ?? `${bike.make} ${bike.model}`;
}

export function MileageOverview({ motorcycles, isDark, onBikePress }: MileageOverviewProps) {
  const hasMileage = motorcycles.some((m) => m.currentMileage != null);
  const isMultiBike = motorcycles.length > 1;

  return (
    <Animated.View entering={FadeInUp.delay(200).duration(300)}>
      <SectionHeader
        icon={Gauge}
        iconColor={palette.primary500}
        title="Mileage" // TODO: i18n
        isDark={isDark}
      />

      {!hasMileage ? (
        <CardWrapper
          tier="subtle"
          style={{
            borderWidth: 1,
            borderStyle: 'dashed',
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
              No mileage recorded{/* TODO: i18n */}
            </Text>
            <Text
              style={{
                fontSize: 12,
                color: palette.primary500,
                fontWeight: '600',
              }}
            >
              Tap to update{/* TODO: i18n */}
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
                    Not recorded{/* TODO: i18n */}
                  </Text>
                )}
              </Pressable>
            </CardWrapper>
          ))}
        </ScrollView>
      ) : (
        <CardWrapper tier="medium">
          <Pressable
            onPress={() => {
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
              onBikePress(motorcycles[0].id);
            }}
            style={({ pressed }) => ({
              padding: 20,
              transform: [{ scale: pressed ? 0.98 : 1 }],
            })}
          >
            <View style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6 }}>
              <Text
                style={{
                  fontSize: 28,
                  fontWeight: '700',
                  color: isDark ? palette.neutral50 : palette.neutral950,
                  fontVariant: ['tabular-nums'],
                }}
              >
                {formatMileage(motorcycles[0].currentMileage!)}
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
              <Text
                style={{
                  fontSize: 12,
                  color: palette.neutral400,
                  fontWeight: '500',
                  marginTop: 4,
                }}
              >
                Updated {getRelativeTime(motorcycles[0].mileageUpdatedAt)}{/* TODO: i18n */}
              </Text>
            )}
          </Pressable>
        </CardWrapper>
      )}
    </Animated.View>
  );
}
