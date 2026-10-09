import type { MakeStatsQuery, MotorcycleMakesQuery } from '@motovault/graphql';
import { Plus, Search } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, TextInput, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MAKE_COLORS, POPULAR_MAKES } from '../../../config/brand-dna';
import { radius, space, type } from '../../../theme/type';
import { useOnboardingColors } from '../onboarding-colors';

type Make = MotorcycleMakesQuery['motorcycleMakes'][number];
type MakeStat = MakeStatsQuery['makeStats'][number];

interface MakeGridProps {
  makes: Make[];
  stats: MakeStat[];
  onSelect: (make: Make) => void;
  onSelectOther: () => void;
}

function getBadgeColor(makeName: string, fallback: string): string {
  return MAKE_COLORS[makeName] ?? fallback;
}

function findStat(stats: MakeStat[], makeName: string): MakeStat | undefined {
  const lower = makeName.toLowerCase();
  return stats.find((s) => s.make.toLowerCase() === lower);
}

export function MakeGrid({ makes, stats, onSelect, onSelectOther }: MakeGridProps) {
  const oc = useOnboardingColors();
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
          backgroundColor: oc.surfaceInput,
          borderWidth: 1,
          borderColor: oc.borderSubtle,
          borderRadius: radius.control,
          borderCurve: 'continuous',
          paddingHorizontal: 14,
          gap: 10,
        }}
      >
        <Search size={15} color={oc.textMutedIcon} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder={t('onboarding.v2MakeGridSearchPlaceholder' as never)}
          placeholderTextColor={oc.textDimmed}
          autoCapitalize="words"
          autoCorrect={false}
          style={{
            flex: 1,
            minHeight: 44,
            paddingVertical: space.sm,
            color: oc.textPrimary,
            ...type.body,
          }}
        />
      </View>

      {/* Live social-proof teaser — real rider count, only when we have data */}
      {totalRiders > 0 && (
        <Text style={[type.caption, { color: oc.textMuted, paddingLeft: 2 }]}>
          {t('onboarding.v2MakeGridTeaser' as never, { count: totalRiders })}
        </Text>
      )}

      {isSearching ? (
        /* Search results list */
        <View style={{ gap: 6 }}>
          {searchResults.length === 0 && (
            <Text style={[type.subhead, { color: oc.textMuted, padding: space.xs }]}>
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
                  minHeight: 48,
                  paddingHorizontal: 14,
                  borderRadius: radius.control,
                  borderCurve: 'continuous',
                  backgroundColor: oc.surfaceInput,
                  borderWidth: 1,
                  borderColor: oc.borderSubtle,
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
                    backgroundColor: getBadgeColor(m.makeName, oc.brandMarkFallback),
                    alignItems: 'center',
                    justifyContent: 'center',
                  }}
                >
                  <Text style={[type.label, { fontWeight: '700', color: oc.brandMarkInk }]}>
                    {m.makeName[0]}
                  </Text>
                </View>
                <Text style={[type.body, { flex: 1, color: oc.textPrimary }]}>{m.makeName}</Text>
                {stat && stat.riders > 0 && (
                  <Text style={[type.figureSmall, { fontSize: 15, color: oc.textMuted }]}>
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
          <Text style={[type.label, { color: oc.textLabel, paddingLeft: 2 }]}>
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
                    paddingHorizontal: space.sm,
                    borderRadius: radius.control,
                    borderCurve: 'continuous',
                    backgroundColor: oc.surfaceInput,
                    borderWidth: 1,
                    borderColor: oc.borderSubtle,
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
                      style={[
                        type.caption,
                        {
                          position: 'absolute',
                          top: space.xxs,
                          right: space.xs,
                          fontVariant: ['tabular-nums'],
                          color: oc.textMuted,
                        },
                      ]}
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
                      backgroundColor: getBadgeColor(m.makeName, oc.brandMarkFallback),
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={[type.caption, { fontWeight: '700', color: oc.brandMarkInk }]}>
                      {m.makeName[0]}
                    </Text>
                  </View>
                  <Text numberOfLines={1} style={[type.label, { flex: 1, color: oc.textPrimary }]}>
                    {m.makeName}
                  </Text>
                </Pressable>
              );
            })}

            {/* Other make */}
            <Pressable
              onPress={onSelectOther}
              accessibilityRole="button"
              accessibilityLabel="Other make"
              style={{
                width: '100%',
                paddingHorizontal: space.sm,
                borderRadius: radius.control,
                borderCurve: 'continuous',
                backgroundColor: oc.surface2,
                flexDirection: 'row',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 8,
                minHeight: 48,
              }}
            >
              <Plus size={16} color={oc.warm2} />
              <Text style={[type.label, { color: oc.warm2 }]}>
                {t('onboarding.v2MakeGridOther')}
              </Text>
            </Pressable>
          </View>
        </View>
      )}
    </Animated.View>
  );
}
