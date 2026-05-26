import type { MakeStatsQuery, MotorcycleMakesQuery } from '@motovault/graphql';
import { Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MAKE_COLORS, POPULAR_MAKES } from '../../../config/brand-dna';
import { ONBOARDING_COLORS } from '../onboarding-colors';

type Make = MotorcycleMakesQuery['motorcycleMakes'][number];
type MakeStat = MakeStatsQuery['makeStats'][number];

interface MakeGridProps {
  makes: Make[];
  stats: MakeStat[];
  onSelect: (make: Make) => void;
  onSelectOther: () => void;
}

function getBadgeColor(makeName: string): string {
  return MAKE_COLORS[makeName] ?? ONBOARDING_COLORS.warm;
}

function findStat(stats: MakeStat[], makeName: string): MakeStat | undefined {
  const lower = makeName.toLowerCase();
  return stats.find((s) => s.make.toLowerCase() === lower);
}

export function MakeGrid({ makes, stats, onSelect, onSelectOther }: MakeGridProps) {
  const { t } = useTranslation();
  const [query, setQuery] = useState('');

  const popularItems = useMemo(() => {
    return POPULAR_MAKES.map((name) => {
      const found = makes.find((m) => m.makeName.toLowerCase() === name.toLowerCase());
      return found ?? null;
    }).filter(Boolean) as Make[];
  }, [makes]);

  const searchResults = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return makes.filter((m) => m.makeName.toLowerCase().includes(q)).slice(0, 6);
  }, [query, makes]);

  const isSearching = query.trim().length > 0;

  return (
    <Animated.View entering={FadeIn.delay(120).duration(380)} style={{ gap: 12 }}>
      <Text
        style={{
          fontSize: 11,
          fontWeight: '600',
          letterSpacing: 2,
          textTransform: 'uppercase',
          color: ONBOARDING_COLORS.textLabel,
          paddingLeft: 2,
        }}
      >
        {t('onboarding.v2MakeGridLabel')}
      </Text>

      {/* Search input */}
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          backgroundColor: ONBOARDING_COLORS.surfaceInput,
          borderWidth: 1,
          borderColor: ONBOARDING_COLORS.borderSubtle,
          borderRadius: 14,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        <Search size={15} color={ONBOARDING_COLORS.textMutedIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('onboarding.searchMakePlaceholder', { defaultValue: 'Search any make…' })}
          placeholderTextColor={ONBOARDING_COLORS.textDimmed}
          autoCapitalize="words"
          autoCorrect={false}
          style={{
            flex: 1,
            paddingVertical: 12,
            color: ONBOARDING_COLORS.textPrimary,
            fontSize: 14,
          }}
        />
      </View>

      {isSearching ? (
        /* Search results list */
        <View style={{ gap: 6 }}>
          {searchResults.length === 0 && (
            <Text style={{ fontSize: 12.5, color: ONBOARDING_COLORS.textMutedIcon, padding: 8 }}>
              {t('onboarding.v2MakeGridNoMatches')}
            </Text>
          )}
          {searchResults.map((m) => {
            const stat = findStat(stats, m.makeName);
            return (
              <Pressable
                key={m.makeId}
                onPress={() => onSelect(m)}
                accessibilityRole="button"
                accessibilityLabel={m.makeName}
                style={{
                  padding: 12,
                  paddingHorizontal: 14,
                  borderRadius: 12,
                  borderCurve: 'continuous',
                  backgroundColor: ONBOARDING_COLORS.surfaceInput,
                  borderWidth: 1,
                  borderColor: ONBOARDING_COLORS.borderSubtle,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 12,
                }}
              >
                <View
                  style={{
                    width: 26,
                    height: 26,
                    borderRadius: 6,
                    borderCurve: 'continuous',
                    backgroundColor: getBadgeColor(m.makeName),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ fontSize: 11, fontWeight: '800', color: ONBOARDING_COLORS.textWhite }}
                  >
                    {m.makeName[0]}
                  </Text>
                </View>
                <Text
                  style={{
                    flex: 1,
                    fontSize: 14,
                    fontWeight: '500',
                    color: ONBOARDING_COLORS.textPrimary,
                  }}
                >
                  {m.makeName}
                </Text>
                {stat && stat.riders > 0 && (
                  <Text
                    style={{
                      fontFamily: 'GeistMono-Medium',
                      fontSize: 11,
                      color: ONBOARDING_COLORS.textMutedIcon,
                      letterSpacing: 0.8,
                    }}
                  >
                    {stat.riders}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </View>
      ) : (
        /* Popular makes grid */
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {popularItems.map((m) => {
            const stat = findStat(stats, m.makeName);
            return (
              <Pressable
                key={m.makeId}
                onPress={() => onSelect(m)}
                accessibilityRole="button"
                accessibilityLabel={m.makeName}
                style={{
                  width: '48.5%',
                  padding: 14,
                  paddingHorizontal: 12,
                  borderRadius: 14,
                  borderCurve: 'continuous',
                  backgroundColor: ONBOARDING_COLORS.surfaceInput,
                  borderWidth: 1,
                  borderColor: ONBOARDING_COLORS.borderSubtle,
                  flexDirection: 'row',
                  alignItems: 'center',
                  gap: 10,
                  minHeight: 52,
                  position: 'relative',
                }}
              >
                {/* Top-3 rank badge */}
                {stat && stat.rank <= 3 && (
                  <Text
                    style={{
                      position: 'absolute',
                      top: 6,
                      right: 8,
                      fontFamily: 'GeistMono-Medium',
                      fontSize: 8.5,
                      fontWeight: '700',
                      letterSpacing: 1,
                      color: getBadgeColor(m.makeName),
                    }}
                  >
                    #{stat.rank}
                  </Text>
                )}
                <View
                  style={{
                    width: 22,
                    height: 22,
                    borderRadius: 5,
                    borderCurve: 'continuous',
                    backgroundColor: getBadgeColor(m.makeName),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text
                    style={{ fontSize: 10, fontWeight: '800', color: ONBOARDING_COLORS.textWhite }}
                  >
                    {m.makeName[0]}
                  </Text>
                </View>
                <Text
                  numberOfLines={1}
                  style={{
                    flex: 1,
                    fontSize: 12.5,
                    fontWeight: '600',
                    color: ONBOARDING_COLORS.textPrimary,
                    letterSpacing: -0.1,
                  }}
                >
                  {m.makeName}
                </Text>
              </Pressable>
            );
          })}

          {/* Other make — dashed */}
          <Pressable
            onPress={onSelectOther}
            accessibilityRole="button"
            accessibilityLabel="Other make"
            style={{
              width: '100%',
              padding: 14,
              paddingHorizontal: 12,
              borderRadius: 14,
              borderCurve: 'continuous',
              borderWidth: 1,
              borderColor: ONBOARDING_COLORS.borderMuted,
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              minHeight: 44,
            }}
          >
            <Text style={{ fontSize: 16, color: ONBOARDING_COLORS.warm2 }}>+</Text>
            <Text style={{ fontSize: 13, color: ONBOARDING_COLORS.warm2, fontWeight: '500' }}>
              {t('onboarding.v2MakeGridOther')}
            </Text>
          </Pressable>
        </View>
      )}
    </Animated.View>
  );
}
