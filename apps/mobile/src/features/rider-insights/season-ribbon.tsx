import type { MeasurementSystem } from '@motovault/types';
import {
  addDays,
  differenceInCalendarWeeks,
  endOfYear,
  format,
  isSameMonth,
  parseISO,
  startOfWeek,
  startOfYear,
} from 'date-fns';
import { ChevronRight } from 'lucide-react-native';
import { useTranslation } from 'react-i18next';
import { Pressable, Text, useWindowDimensions, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
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
/** Above this text size the heading line wraps instead of squeezing. */
const LARGE_TEXT = 1.3;
const CHEVRON = 18;
const PRESS_TINT = 0.06;

export interface RibbonSlot {
  weekStart: string;
  distanceM: number;
  rides: number;
  /** The week holding the last day of the season so far. */
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
 * The last day of the season so far: today while the season is running (the
 * API may send the whole calendar year), the season's own end once it is over.
 * Dates are `YYYY-MM-DD`, so they compare as strings.
 */
export function seasonEndSoFar(
  season: RiderInsightsData['season'],
  today: string = format(new Date(), ISO_DAY),
): string {
  return today >= season.from && today < season.to ? today : season.to;
}

/**
 * Every week of the season's calendar year, Monday first, with the API's
 * per-week distance where it has one. The ribbon always spans January to
 * December so the month letters line up.
 */
export function summarizeRibbon(
  ribbon: RiderInsightsData['ribbon'],
  season: RiderInsightsData['season'],
  today: string = format(new Date(), ISO_DAY),
): RibbonSummary {
  const from = parseISO(season.from);
  const first = startOfWeek(startOfYear(from), WEEK_OPTIONS);
  const count = differenceInCalendarWeeks(endOfYear(from), first, WEEK_OPTIONS) + 1;
  const currentStart = format(
    startOfWeek(parseISO(seasonEndSoFar(season, today)), WEEK_OPTIONS),
    ISO_DAY,
  );
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

/**
 * A week's first and last day for "{{start}} to {{end}}": the month is named once
 * when the week stays in it ("Aug 24 to 30"), so the line fits beside the heading.
 */
export function weekRange(weekStart: string, language: string): { start: string; end: string } {
  const first = parseISO(weekStart);
  const last = addDays(first, 6);
  const dayMonth = new Intl.DateTimeFormat(language, { day: 'numeric', month: 'short' });
  const dayOnly = new Intl.DateTimeFormat(language, { day: 'numeric' });
  return {
    start: dayMonth.format(first),
    end: (isSameMonth(first, last) ? dayOnly : dayMonth).format(last),
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
  /** Opens the season page: the months and every week ridden. */
  onPress: () => void;
}

/** Weeks ridden this season, one bar per week, January to December; the card opens the season. */
export function SeasonRibbon({ ribbon, season, system, onPress }: SeasonRibbonProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const { fontScale } = useWindowDimensions();
  const language = instance.language;
  const summary = summarizeRibbon(ribbon, season);
  const max = summary.biggest?.distanceM ?? 0;

  const monthLetter = new Intl.DateTimeFormat(language, { month: 'narrow' });
  const year = parseISO(season.from).getFullYear();

  const weeksLine = i18n('riderInsights.ribbon.weeksRidden', {
    ridden: summary.weeksRidden,
    total: summary.weeksSoFar,
  });
  const biggestLine = summary.biggest
    ? i18n('riderInsights.ribbon.biggest', {
        distance: formatInsightDistance(summary.biggest.distanceM, system, language),
        ...weekRange(summary.biggest.weekStart, language),
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
      <Pressable
        testID="season-ribbon"
        accessibilityRole="button"
        accessibilityLabel={[weeksLine, biggestLine].filter(Boolean).join('. ')}
        accessibilityHint={i18n('riderInsights.ribbon.openHint')}
        onPress={onPress}
        android_ripple={{ color: t.line }}
        style={({ pressed }) => ({
          backgroundColor:
            pressed && process.env.EXPO_OS === 'ios' ? tint(t.ink, PRESS_TINT) : t.surface,
          borderRadius: radius.card,
          borderCurve: 'continuous',
          overflow: 'hidden',
          paddingHorizontal: space.md,
          paddingVertical: space.sm,
          gap: space.xs,
        })}
      >
        {/* "Biggest" sits on the heading line, right-aligned; at large text sizes it wraps under. */}
        <View
          style={{
            flexDirection: 'row',
            flexWrap: fontScale > LARGE_TEXT ? 'wrap' : 'nowrap',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            columnGap: space.sm,
          }}
        >
          <Text style={[type.figureSmall, { color: t.ink, flexShrink: 0 }]}>{weeksLine}</Text>
          {biggestLine ? (
            <Text
              style={[
                type.caption,
                {
                  color: t.ink3,
                  flexGrow: 1,
                  flexShrink: 1,
                  textAlign: fontScale > LARGE_TEXT ? 'left' : 'right',
                },
              ]}
            >
              {biggestLine}
            </Text>
          ) : (
            <View style={{ flexGrow: 1 }} />
          )}
          <ChevronRight
            size={CHEVRON}
            color={t.ink3}
            strokeWidth={2}
            style={{ alignSelf: 'center' }}
          />
        </View>
        <View
          testID="season-ribbon-bars"
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
      </Pressable>
    </View>
  );
}
