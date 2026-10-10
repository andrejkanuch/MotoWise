import type { MakeStatsQuery, MotorcycleMakesQuery } from '@motovault/graphql';
import { Plus } from 'lucide-react-native';
import { useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { MAKE_COLORS, POPULAR_MAKES } from '@/config/brand-dna';
import { space, type } from '@/theme/type';
import { useOnboardingColors } from '../onboarding-colors';
import { MakeBadge, PickerGroup, PickerLabel, PickerRow, PickerSearchField } from './picker-ui';

type Make = MotorcycleMakesQuery['motorcycleMakes'][number];
type MakeStat = MakeStatsQuery['makeStats'][number];

interface MakeGridProps {
  makes: Make[];
  stats: MakeStat[];
  onSelect: (make: Make) => void;
  onSelectOther: () => void;
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

  const rowFor = (m: Make) => {
    const stat = findStat(stats, m.makeName);
    return (
      <PickerRow
        key={m.makeId}
        title={m.makeName}
        detail={stat && stat.riders > 0 ? String(stat.riders) : undefined}
        leading={<MakeBadge makeName={m.makeName} color={MAKE_COLORS[m.makeName]} />}
        onPress={() => onSelect(m)}
        chevron
      />
    );
  };

  return (
    <Animated.View entering={FadeIn.duration(240)} style={{ gap: space.md }}>
      <View style={{ gap: space.xs }}>
        <PickerSearchField
          value={query}
          onChangeText={setQuery}
          placeholder={t('onboarding.v2MakeGridSearchPlaceholder' as never)}
        />
        {/* Live social-proof teaser — real rider count, only when we have data */}
        {totalRiders > 0 && (
          <Text style={[type.caption, { color: oc.textMuted, marginLeft: space.xxs }]}>
            {t('onboarding.v2MakeGridTeaser' as never, { count: totalRiders })}
          </Text>
        )}
      </View>

      {isSearching ? (
        searchResults.length === 0 ? (
          <Text style={[type.subhead, { color: oc.textMuted, marginLeft: space.xxs }]}>
            {t('onboarding.v2MakeGridNoMatches')}
          </Text>
        ) : (
          <PickerGroup>{searchResults.map(rowFor)}</PickerGroup>
        )
      ) : (
        <View>
          <PickerLabel>{t('onboarding.v2MakeGridPopularLabel' as never)}</PickerLabel>
          <PickerGroup>{popularItems.map(rowFor)}</PickerGroup>
        </View>
      )}

      {/* Other make */}
      <PickerGroup>
        <PickerRow
          title={t('onboarding.v2MakeGridOther')}
          accessibilityLabel="Other make"
          leading={<Plus size={18} color={oc.warm2} />}
          accent
          onPress={onSelectOther}
        />
      </PickerGroup>
    </Animated.View>
  );
}
