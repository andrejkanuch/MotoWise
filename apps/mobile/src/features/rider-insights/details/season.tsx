import type { MeasurementSystem } from '@motovault/types';
import { format, parseISO } from 'date-fns';
import { ChevronDown, ChevronRight } from 'lucide-react-native';
import { type ReactNode, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ActivityIndicator, Pressable, Text, View } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { SYSTEM_WEIGHT, type } from '@/theme/type';
import { triggerSelection } from '@/utils/haptics';
import { summarizeRibbon, weekRange } from '../season-ribbon';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import { formatNumber, shortDate } from './detail-format';
import { DetailHero, Footnote, openRide, RowList, Section, ValueRow } from './detail-parts';
import {
  type MyRide,
  type SeasonMonth,
  type SeasonWeek,
  seasonMonths,
  seasonWeeks,
} from './season-model';
import { useWeekRides } from './use-week-rides';

const CHEVRON = 18;
/** Separator inset for week rows, which lead with a chevron. */
const WEEK_ROW_INSET = space.md + CHEVRON + space.sm;
const NO_VALUE = '–';
const ISO_DAY = 'yyyy-MM-dd';

/** "March": a month name as a row title, capitalised in languages that write it lower case. */
function monthTitle(month: string, language: string): string {
  const name = new Intl.DateTimeFormat(language, { month: 'long' }).format(parseISO(`${month}-01`));
  return name.charAt(0).toLocaleUpperCase(language) + name.slice(1);
}

/** "Sat 7 Mar, 09:12": when a ride started, in the rider's language and time zone. */
function rideStart(startedAt: string, language: string): string {
  return new Intl.DateTimeFormat(language, {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    hour: 'numeric',
    minute: '2-digit',
  }).format(parseISO(startedAt));
}

/**
 * The season page: weeks ridden as the figure, then each month so far with its
 * distance and rides, then every week ridden; a week opens to its own rides,
 * and each ride opens ride detail. Free: it is the ribbon's data, spelled out.
 */
export function SeasonDetail({
  insights,
  system,
}: {
  insights: RiderInsightsData;
  system: MeasurementSystem;
}) {
  const { t: i18n, i18n: instance } = useTranslation();
  const language = instance.language;
  const [openWeek, setOpenWeek] = useState<string | null>(null);
  const weekRides = useWeekRides(openWeek);
  const { weeksRidden, weeksSoFar } = summarizeRibbon(insights.ribbon, insights.season);
  const months = seasonMonths(insights.ribbon, insights.season);
  const weeks = seasonWeeks(insights.ribbon, insights.season);
  const distance = (meters: number) => formatInsightDistance(meters, system, language);

  const monthRow = (month: SeasonMonth) => (
    <ValueRow
      key={month.month}
      testID={`season-month-${month.month}`}
      title={monthTitle(month.month, language)}
      caption={
        month.rides > 0
          ? i18n('riderInsights.detail.season.rides', { count: month.rides })
          : i18n('riderInsights.detail.season.noRides')
      }
      value={month.rides > 0 ? distance(month.distanceM) : NO_VALUE}
    />
  );

  const weekRows = (week: SeasonWeek): ReactNode[] => {
    const open = openWeek === week.weekStart;
    const caption = [
      i18n('riderInsights.detail.season.rides', { count: week.rides }),
      week.biggest ? i18n('riderInsights.detail.season.biggest') : null,
    ]
      .filter(Boolean)
      .join(' · ');
    const row = (
      <ValueRow
        key={week.weekStart}
        testID={`season-week-${week.weekStart}`}
        leading={<WeekChevron open={open} />}
        title={i18n('riderInsights.detail.season.week', weekRange(week.weekStart, language))}
        caption={caption}
        value={distance(week.distanceM)}
        expanded={open}
        onPress={() => {
          triggerSelection();
          setOpenWeek(open ? null : week.weekStart);
        }}
      />
    );
    return open
      ? [row, <WeekRides key={`${week.weekStart}-rides`} {...weekRides} distance={distance} />]
      : [row];
  };

  return (
    <>
      <DetailHero
        figure={formatNumber(weeksRidden, language)}
        line={i18n('riderInsights.detail.season.heroLine', { count: weeksSoFar })}
      />
      <Section title={i18n('riderInsights.detail.season.months')}>
        <RowList rows={months.map(monthRow)} inset={space.md} />
      </Section>
      {weeks.length > 0 ? (
        <Section title={i18n('riderInsights.detail.season.weeks')}>
          <RowList rows={weeks.flatMap(weekRows)} inset={WEEK_ROW_INSET} />
        </Section>
      ) : null}
      <Footnote>{i18n('riderInsights.detail.season.footnote')}</Footnote>
    </>
  );
}

function WeekChevron({ open }: { open: boolean }) {
  const { t } = useEditorialTheme();
  const Icon = open ? ChevronDown : ChevronRight;
  return <Icon size={CHEVRON} color={t.ink3} strokeWidth={2} />;
}

interface WeekRidesProps {
  rides: MyRide[];
  loading: boolean;
  failed: boolean;
  retry: () => void;
  distance: (meters: number) => string;
}

/** An open week's rides, indented to the week's text; each opens ride detail. */
function WeekRides({ rides, loading, failed, retry, distance }: WeekRidesProps) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const indent = <View style={{ width: CHEVRON }} />;
  const note = { paddingVertical: space.sm, paddingLeft: WEEK_ROW_INSET, paddingRight: space.md };

  if (loading) {
    return (
      <View testID="week-rides-loading" style={[note, { alignItems: 'flex-start' }]}>
        <ActivityIndicator
          color={t.ink3}
          accessibilityLabel={i18n('riderInsights.detail.season.loadingRides')}
        />
      </View>
    );
  }
  if (failed) {
    return (
      <View testID="week-rides-error" style={[note, { gap: space.xxs }]}>
        <Text style={[type.subhead, { color: t.ink2 }]}>
          {i18n('riderInsights.detail.season.loadFailed')}
        </Text>
        <Pressable
          accessibilityRole="button"
          onPress={retry}
          hitSlop={space.xs}
          style={{ alignSelf: 'flex-start' }}
        >
          <Text style={[type.subhead, SYSTEM_WEIGHT.semibold, { color: t.warm2 }]}>
            {i18n('riderInsights.detail.season.retry')}
          </Text>
        </Pressable>
      </View>
    );
  }
  if (rides.length === 0) {
    return (
      <View testID="week-rides-empty" style={note}>
        <Text style={[type.subhead, { color: t.ink3 }]}>
          {i18n('riderInsights.detail.season.noWeekRides')}
        </Text>
      </View>
    );
  }
  return (
    <View testID="week-rides">
      {rides.map((ride) => {
        const when = rideStart(ride.startedAt, language);
        return (
          <ValueRow
            key={ride.id}
            testID={`week-ride-${ride.id}`}
            leading={indent}
            title={
              ride.name ??
              i18n('riderInsights.howYouRide.bestRides.unnamed', {
                date: shortDate(format(parseISO(ride.startedAt), ISO_DAY), language),
              })
            }
            caption={when}
            value={distance(ride.distanceM ?? 0)}
            onPress={() => openRide(ride.id)}
          />
        );
      })}
    </View>
  );
}
