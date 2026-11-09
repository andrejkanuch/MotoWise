import type { MeasurementSystem } from '@motovault/types';
import {
  addDays,
  differenceInCalendarWeeks,
  endOfYear,
  format,
  parseISO,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { layout, space } from '@/theme/spacing';
import { radius, type } from '@/theme/type';
import { formatInsightDistance, type RiderInsightsData } from './use-rider-insights';

const WEEK_OPTIONS = { weekStartsOn: 1 } as const;
const BAR_AREA_HEIGHT = 48;
const EMPTY_BAR_HEIGHT = 2;
const MIN_BAR_HEIGHT = 3;
const BAR_SEAM = 1.5;
const MONTHS = 12;
const ISO_DAY = 'yyyy-MM-dd';

export interface RibbonSlot {
  weekStart: string;
  distanceM: number;
  rides: number;
  /** The week holding the last day of the season shown. */
  current: boolean;
}

export interface RibbonSummary {
  slots: RibbonSlot[];
  weeksRidden: number;
  /** Weeks from the season's first week to the current one. */
  weeksSoFar: number;
  biggest: RibbonSlot | null;
}

/**
 * Every week of the season's calendar year, Monday first, with the API's
 * per-week distance where it has one. The ribbon always spans January to
 * December so the month letters line up.
 */
export function summarizeRibbon(
  ribbon: RiderInsightsData['ribbon'],
  season: RiderInsightsData['season'],
): RibbonSummary {
  const from = parseISO(season.from);
  const first = startOfWeek(startOfYear(from), WEEK_OPTIONS);
  const count = differenceInCalendarWeeks(endOfYear(from), first, WEEK_OPTIONS) + 1;
  const currentStart = format(startOfWeek(parseISO(season.to), WEEK_OPTIONS), ISO_DAY);
  const byWeek = new Map(ribbon.map((week) => [week.weekStart, week]));

  const slots = Array.from({ length: count }, (_, i): RibbonSlot => {
    const weekStart = format(addDays(first, i * 7), ISO_DAY);
    const week = byWeek.get(weekStart);
    return {
      weekStart,
      distanceM: week?.distanceM ?? 0,
      rides: week?.rides ?? 0,
      current: weekStart === currentStart,
    };
  });

  const ridden = slots.filter((slot) => slot.rides > 0);
  const biggest = ridden.reduce<RibbonSlot | null>(
    (best, slot) => (best === null || slot.distanceM > best.distanceM ? slot : best),
    null,
  );
  const currentIndex = slots.findIndex((slot) => slot.current);

  return {
    slots,
    weeksRidden: ridden.length,
    weeksSoFar: currentIndex === -1 ? count : currentIndex + 1,
    biggest,
  };
}

function barHeight(distanceM: number, max: number): number {
  if (distanceM <= 0 || max <= 0) return EMPTY_BAR_HEIGHT;
  return Math.max(MIN_BAR_HEIGHT, Math.round((distanceM / max) * BAR_AREA_HEIGHT));
}

interface SeasonRibbonProps {
  ribbon: RiderInsightsData['ribbon'];
  season: RiderInsightsData['season'];
  system: MeasurementSystem;
}

/** Weeks ridden this season, one bar per week, January to December. */
export function SeasonRibbon({ ribbon, season, system }: SeasonRibbonProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const summary = summarizeRibbon(ribbon, season);
  const max = summary.biggest?.distanceM ?? 0;

  const dayMonth = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const monthLetter = new Intl.DateTimeFormat(language, { month: 'narrow' });
  const year = parseISO(season.from).getFullYear();

  const weeksLine = i18n('riderInsights.ribbon.weeksRidden', {
    ridden: summary.weeksRidden,
    total: summary.weeksSoFar,
  });
  const biggestLine = summary.biggest
    ? i18n('riderInsights.ribbon.biggest', {
        distance: formatInsightDistance(summary.biggest.distanceM, system, language),
        start: dayMonth.format(parseISO(summary.biggest.weekStart)),
        end: dayMonth.format(addDays(parseISO(summary.biggest.weekStart), 6)),
      })
    : null;

  return (
    <View style={{ gap: layout.labelGap }}>
      <Text
        accessibilityRole="header"
        style={[type.label, { color: t.ink3, marginHorizontal: space.md }]}
      >
        {i18n('riderInsights.ribbon.section')}
      </Text>
      <View
        style={{
          backgroundColor: t.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          gap: space.xs,
        }}
      >
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            columnGap: space.sm,
          }}
        >
          <Text style={[type.figureSmall, { color: t.ink }]}>{weeksLine}</Text>
          {biggestLine ? (
            <Text style={[type.caption, { color: t.ink3 }]}>{biggestLine}</Text>
          ) : null}
        </View>
        <View
          testID="season-ribbon-bars"
          accessible
          accessibilityRole="image"
          accessibilityLabel={[weeksLine, biggestLine].filter(Boolean).join('. ')}
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
            gap: BAR_SEAM,
            height: BAR_AREA_HEIGHT,
          }}
        >
          {summary.slots.map((slot) => (
            <View
              key={slot.weekStart}
              style={{
                flex: 1,
                height: barHeight(slot.distanceM, max),
                borderRadius: 1,
                backgroundColor: slot.rides === 0 ? t.surface2 : slot.current ? t.ink : t.ink3,
              }}
            />
          ))}
        </View>
        <View
          style={{ flexDirection: 'row' }}
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
        >
          {Array.from({ length: MONTHS }, (_, month) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: twelve fixed months
            <Text key={month} style={[type.caption, { flex: 1, color: t.ink3 }]}>
              {monthLetter.format(new Date(year, month, 1))}
            </Text>
          ))}
        </View>
      </View>
    </View>
  );
}
