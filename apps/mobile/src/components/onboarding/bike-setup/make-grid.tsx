import type { MakeStatsQuery, MotorcycleMakesQuery } from '@motovault/graphql';
import { Search } from 'lucide-react-native';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
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

/** Pulsing green "live" dot for the social-proof teaser. */
function PulseDot() {
  const scale = useSharedValue(1);

  useEffect(() => {
    scale.value = withRepeat(
      withSequence(
        withTiming(1.5, { duration: 900, easing: Easing.inOut(Easing.ease) }),
        withTiming(1, { duration: 900, easing: Easing.inOut(Easing.ease) }),
      ),
      -1,
      false,
    );
  }, [scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  return (
    <Animated.View
      style={[
        { width: 6, height: 6, borderRadius: 3, backgroundColor: ONBOARDING_COLORS.green },
        style,
      ]}
    />
  );
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
    // Tokenize so a full bike name ("Honda Africa Twin") still surfaces the make
    // ("Honda"): match the whole query as a substring, OR any 2+ char word in it
    // against the make name. Tokens <2 chars are ignored to avoid noise matches.
    const tokens = q.split(/\s+/).filter((tok) => tok.length >= 2);
    const firstTok = tokens[0] ?? q;
    return makes
      .filter((m) => {
        const name = m.makeName.toLowerCase();
        if (name.includes(q)) return true;
        return tokens.some((tok) => name.includes(tok));
      })
      .sort((a, b) => {
        // Surface makes whose name starts with the query first.
        const aStarts = a.makeName.toLowerCase().startsWith(firstTok) ? 0 : 1;
        const bStarts = b.makeName.toLowerCase().startsWith(firstTok) ? 0 : 1;
        return aStarts - bStarts;
      })
      .slice(0, 8);
  }, [query, makes]);

  const isSearching = query.trim().length > 0;

  // Real social proof — total riders across all makes (from live fleet stats).
  // Shown only when we actually have data; never a fabricated figure.
  const totalRiders = useMemo(() => stats.reduce((sum, s) => sum + (s.riders ?? 0), 0), [stats]);

  return (
    <Animated.View entering={FadeIn.delay(120).duration(380)} style={{ gap: 12 }}>
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
          placeholder={t('onboarding.v2MakeGridSearchPlaceholder' as never)}
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

      {/* Live social-proof teaser — real rider count, only when we have data */}
      {totalRiders > 0 && (
        <View
          style={{
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
            paddingLeft: 4,
          }}
        >
          <PulseDot />
          <Text
            style={{
              fontFamily: 'GeistMono-Medium',
              fontSize: 10.5,
              letterSpacing: 0.8,
              color: ONBOARDING_COLORS.textMutedIcon,
            }}
          >
            {t('onboarding.v2MakeGridTeaser' as never, { count: totalRiders })}
          </Text>
        </View>
      )}

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
        <View style={{ gap: 12 }}>
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
            {t('onboarding.v2MakeGridPopularLabel' as never)}
          </Text>
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
                      style={{
                        fontSize: 10,
                        fontWeight: '800',
                        color: ONBOARDING_COLORS.textWhite,
                      }}
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
        </View>
      )}
    </Animated.View>
  );
}
