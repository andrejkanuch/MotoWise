import type { MakeStatsQuery } from '@motovault/graphql';
import { RefreshCw } from 'lucide-react-native';
import { useMemo } from 'react';
import { Pressable, Text, View } from 'react-native';
import Animated, { FadeIn, FadeInUp } from 'react-native-reanimated';
import { type BrandInfo, getBrandColor, getBrandDna } from '../../../config/brand-dna';
import { ONBOARDING_COLORS } from '../onboarding-colors';

type MakeStat = MakeStatsQuery['makeStats'][number];

interface BrandHeroProps {
  makeName: string;
  isCustom: boolean;
  stats: MakeStat[];
  onChangeMake: () => void;
}

function PopularityBadge({ stat, color }: { stat: MakeStat; color: string }) {
  const label =
    stat.rank === 1 ? 'Most popular' : stat.rank <= 3 ? 'Top 3' : stat.rank <= 8 ? 'Popular' : null;
  if (!label) return null;

  return (
    <Animated.View
      entering={FadeIn.delay(300).duration(380)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        gap: 6,
        paddingVertical: 4,
        paddingHorizontal: 9,
        borderRadius: 999,
        backgroundColor: `${color}24`,
        borderWidth: 1,
        borderColor: `${color}59`,
        marginBottom: 10,
      }}
    >
      {stat.rank <= 3 && <Text style={{ fontSize: 9, color }}>★</Text>}
      <Text
        style={{
          fontFamily: 'GeistMono-Medium',
          fontSize: 9.5,
          fontWeight: '600',
          letterSpacing: 1.5,
          textTransform: 'uppercase',
          color,
        }}
      >
        {label}
        {stat.riders > 0 && ` · ${stat.riders} riders`}
      </Text>
    </Animated.View>
  );
}

function StatsRow({
  brandDna,
  stat,
  isCustom,
  color,
}: {
  brandDna: BrandInfo | null;
  stat: MakeStat | undefined;
  isCustom: boolean;
  color: string;
}) {
  const cells = useMemo(() => {
    const result: { big: string; label: string }[] = [];
    // Service interval — from manufacturer spec (always available for known brands)
    if (brandDna?.serviceInterval) {
      result.push({ big: brandDna.serviceInterval, label: 'Service interval' });
    }
    // Riders — real fleet data only
    if (!isCustom && stat && stat.riders > 0) {
      result.push({ big: String(stat.riders), label: 'Riders on this' });
    }
    // Models — real fleet data only
    if (!isCustom && stat && stat.models > 0) {
      result.push({ big: String(stat.models), label: 'Models tracked' });
    }
    return result;
  }, [brandDna, stat, isCustom]);

  if (cells.length === 0) return null;

  return (
    <Animated.View entering={FadeInUp.delay(400).duration(450)}>
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 8,
          marginBottom: 10,
        }}
      >
        <View
          style={{
            width: 6,
            height: 6,
            borderRadius: 3,
            backgroundColor: color,
          }}
        />
        <Text
          style={{
            fontSize: 11,
            fontWeight: '600',
            letterSpacing: 1.5,
            textTransform: 'uppercase',
            color,
          }}
        >
          Loaded for you
        </Text>
      </View>

      <View style={{ flexDirection: 'row', gap: 8 }}>
        {cells.map((cell, i) => (
          <View
            key={cell.label}
            style={{
              flex: 1,
              padding: 12,
              paddingHorizontal: 10,
              borderRadius: 14,
              borderCurve: 'continuous',
              backgroundColor: 'rgba(22, 19, 15, 0.7)',
              borderWidth: 1,
              borderColor: i === 0 ? `${color}4D` : '#2a2520',
            }}
          >
            <Text
              style={{
                fontFamily: 'InstrumentSerif-Regular',
                fontSize: 22,
                color: i === 0 ? color : '#fff',
                letterSpacing: -0.4,
                lineHeight: 24,
                marginBottom: 6,
              }}
              numberOfLines={1}
            >
              {cell.big}
            </Text>
            <Text
              style={{
                fontFamily: 'GeistMono-Medium',
                fontSize: 9.5,
                fontWeight: '600',
                letterSpacing: 1,
                textTransform: 'uppercase',
                color: 'rgba(255,255,255,0.5)',
                lineHeight: 12,
              }}
            >
              {cell.label}
            </Text>
          </View>
        ))}
      </View>
    </Animated.View>
  );
}

function RegisteredStamp({
  makeName,
  isCustom,
  stat,
  color,
}: {
  makeName: string;
  isCustom: boolean;
  stat: MakeStat | undefined;
  color: string;
}) {
  const stampDate = useMemo(() => {
    const d = new Date();
    const months = [
      'JAN',
      'FEB',
      'MAR',
      'APR',
      'MAY',
      'JUN',
      'JUL',
      'AUG',
      'SEP',
      'OCT',
      'NOV',
      'DEC',
    ];
    return `${String(d.getDate()).padStart(2, '0')} ${months[d.getMonth()]} ${d.getFullYear()}`;
  }, []);

  const welcomeMessage = isCustom
    ? "Welcome — we'll learn your bike with you."
    : stat && stat.riders > 0
      ? `Welcome to ${stat.riders + 1} ${makeName} riders on MotoVault.`
      : `Welcome, ${makeName} rider.`;

  return (
    <Animated.View
      entering={FadeInUp.delay(650).duration(460)}
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        padding: 14,
        paddingHorizontal: 16,
        borderRadius: 16,
        borderCurve: 'continuous',
        backgroundColor: 'rgba(0,0,0,0.28)',
        borderWidth: 1,
        borderColor: 'rgba(255,255,255,0.1)',
        borderStyle: 'dashed',
      }}
    >
      {/* Seal */}
      <View
        style={{
          width: 48,
          height: 48,
          borderRadius: 24,
          borderWidth: 2,
          borderColor: color,
          backgroundColor: `${color}14`,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Text
          style={{
            fontFamily: 'InstrumentSerif-Italic',
            fontSize: 22,
            lineHeight: 24,
            color,
          }}
        >
          {isCustom ? '?' : makeName[0]}
        </Text>
      </View>

      <View style={{ flex: 1, minWidth: 0 }}>
        <Text
          style={{
            fontFamily: 'GeistMono-Medium',
            fontSize: 9.5,
            fontWeight: '700',
            letterSpacing: 1.7,
            color,
            textTransform: 'uppercase',
            marginBottom: 3,
          }}
        >
          Registered · {stampDate}
        </Text>
        <Text
          style={{
            fontSize: 13,
            fontWeight: '500',
            color: ONBOARDING_COLORS.textPrimary,
            letterSpacing: -0.1,
          }}
        >
          {welcomeMessage}
        </Text>
      </View>
    </Animated.View>
  );
}

export function BrandHero({ makeName, isCustom, stats, onChangeMake }: BrandHeroProps) {
  const color = getBrandColor(makeName);
  const brandDna = getBrandDna(makeName);
  const stat = stats.find((s) => s.make.toLowerCase() === makeName.toLowerCase());

  return (
    <View style={{ gap: 16 }}>
      {/* Hero card */}
      <Animated.View
        entering={FadeIn.duration(540)}
        style={{
          position: 'relative',
          borderRadius: 22,
          borderCurve: 'continuous',
          overflow: 'hidden',
          padding: 20,
          paddingBottom: 24,
          minHeight: 180,
          backgroundColor: isCustom ? '#16130f' : `${color}12`,
          borderWidth: 1,
          borderColor: isCustom ? '#2a2520' : `${color}59`,
          ...(process.env.EXPO_OS === 'ios' && !isCustom
            ? {
                shadowColor: color,
                shadowOffset: { width: 0, height: 7 },
                shadowOpacity: 0.22,
                shadowRadius: 20,
              }
            : {}),
        }}
      >
        {/* Change button */}
        <View style={{ alignItems: 'flex-end' }}>
          <Pressable
            onPress={onChangeMake}
            accessibilityRole="button"
            accessibilityLabel="Change make"
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              gap: 6,
              paddingVertical: 6,
              paddingHorizontal: 10,
              borderRadius: 999,
              backgroundColor: 'rgba(0,0,0,0.35)',
              borderWidth: 1,
              borderColor: 'rgba(255,255,255,0.14)',
            }}
          >
            <RefreshCw size={11} color="rgba(255,255,255,0.85)" />
            <Text
              style={{
                fontSize: 11,
                fontWeight: '600',
                color: 'rgba(255,255,255,0.85)',
                letterSpacing: 0.4,
              }}
            >
              Change
            </Text>
          </Pressable>
        </View>

        {/* Brand identity */}
        <View style={{ marginTop: 14, maxWidth: '78%' }}>
          {/* Popularity badge */}
          {stat && !isCustom && <PopularityBadge stat={stat} color={color} />}

          {/* Make name */}
          <Animated.Text
            entering={FadeInUp.delay(200).duration(600)}
            style={{
              fontFamily: 'InstrumentSerif-Italic',
              fontSize: 48,
              lineHeight: 56,
              letterSpacing: -1,
              color: '#fff',
              marginBottom: 8,
              overflow: 'visible',
              ...(process.env.EXPO_OS === 'ios' && !isCustom
                ? {
                    textShadowColor: `${color}88`,
                    textShadowOffset: { width: 0, height: 2 },
                    textShadowRadius: 24,
                  }
                : {}),
            }}
          >
            {isCustom ? 'Other' : makeName}
          </Animated.Text>

          {/* Tagline */}
          <Animated.Text
            entering={FadeIn.delay(450).duration(500)}
            style={{
              fontSize: 13.5,
              lineHeight: 19,
              color: 'rgba(255,255,255,0.78)',
              fontStyle: 'italic',
              maxWidth: 240,
            }}
          >
            {isCustom ? 'We adapt to what you ride.' : (brandDna?.tagline ?? '')}
          </Animated.Text>
        </View>
      </Animated.View>

      {/* Stats row — only if we have data */}
      <StatsRow brandDna={brandDna} stat={stat} isCustom={isCustom} color={color} />

      {/* Registered stamp */}
      <RegisteredStamp makeName={makeName} isCustom={isCustom} stat={stat} color={color} />
    </View>
  );
}
