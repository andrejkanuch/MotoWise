import type { MeasurementSystem } from '@motovault/types';
import type { TFunction } from 'i18next';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { tint, useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import { formatDuration } from '@/utils/ride-formatters';
import { busiestSlot, gridLevels } from '../how-you-ride-list';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import { formatPercent } from './detail-format';
import { Card, DetailHero, Footnote, RowList, Section, ValueRow } from './detail-parts';

type RhythmDetailData = NonNullable<RiderInsightsData['rhythm']['detail']>;

/** Ink strength per grid level 1-3; level 0 is the raised step. */
const LEVEL_ALPHAS = [0, 0.36, 0.62, 0.92] as const;
const CELL_HEIGHT = 24;
const CELL_SEAM = 2;
const CELL_RADIUS = 4;
/** A Monday, so `MONDAY + n days` names weekday n of the API's Monday-first grid. */
const MONDAY = Date.UTC(2024, 0, 1);
const DAY_MS = 86_400_000;
const DAYS = 7;

const PARTS = ['morning', 'afternoon', 'evening', 'night'] as const;
type Part = (typeof PARTS)[number];

const PART_LABEL: Record<Part, (t: TFunction) => string> = {
  morning: (t) => t('riderInsights.detail.rhythm.part.morning'),
  afternoon: (t) => t('riderInsights.detail.rhythm.part.afternoon'),
  evening: (t) => t('riderInsights.detail.rhythm.part.evening'),
  night: (t) => t('riderInsights.detail.rhythm.part.night'),
};

interface Props {
  detail: RhythmDetailData;
  system: MeasurementSystem;
}

/** Riding rhythm: the weekday by time-of-day grid, the busiest slot, the weekend share and the typical ride. */
export function RhythmDetail({ detail, system }: Props) {
  const { t: i18n, i18n: instance } = useTranslation();
  const { t } = useEditorialTheme();
  const language = instance.language;
  const slot = busiestSlot(detail.grid, i18n, language);
  const levels = gridLevels(detail.grid);
  const weekdayFormat = new Intl.DateTimeFormat(language, { weekday: 'narrow', timeZone: 'UTC' });
  const dayLetters = Array.from({ length: DAYS }, (_, d) =>
    weekdayFormat.format(new Date(MONDAY + d * DAY_MS)),
  );

  const typical =
    detail.medianDistanceM === null
      ? null
      : [
          formatInsightDistance(detail.medianDistanceM, system, language),
          detail.medianMovingTimeS === null ? null : formatDuration(detail.medianMovingTimeS),
        ]
          .filter(Boolean)
          .join(' · ');

  return (
    <>
      <View style={{ gap: space.sm }}>
        <DetailHero
          figure={
            detail.weekendShare === null ? null : formatPercent(detail.weekendShare, language)
          }
          line={i18n('riderInsights.howYouRide.rhythm.weekend', {
            count: detail.rides,
            weekend: detail.weekendRides,
          })}
        />
        <Card padded>
          <View
            testID="rhythm-grid"
            accessible
            accessibilityRole="image"
            accessibilityLabel={
              slot
                ? i18n('riderInsights.howYouRide.rhythm.a11y', { slot })
                : i18n('riderInsights.howYouRide.keepRiding')
            }
            style={{ gap: CELL_SEAM }}
          >
            <View style={{ flexDirection: 'row', gap: CELL_SEAM }}>
              <View style={{ flex: 2 }} />
              {dayLetters.map((letter, d) => (
                <Text
                  // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed days
                  key={d}
                  style={[type.caption, { flex: 1, textAlign: 'center', color: t.ink3 }]}
                >
                  {letter}
                </Text>
              ))}
            </View>
            {PARTS.map((part, p) => (
              <View
                key={part}
                style={{ flexDirection: 'row', alignItems: 'center', gap: CELL_SEAM }}
              >
                <Text numberOfLines={1} style={[type.caption, { flex: 2, color: t.ink3 }]}>
                  {PART_LABEL[part](i18n)}
                </Text>
                {levels.map((day, d) => (
                  <View
                    // biome-ignore lint/suspicious/noArrayIndexKey: seven fixed days
                    key={d}
                    style={{
                      flex: 1,
                      height: CELL_HEIGHT,
                      borderRadius: CELL_RADIUS,
                      borderCurve: 'continuous',
                      backgroundColor:
                        day[p] > 0 ? tint(t.ink, LEVEL_ALPHAS[day[p]] ?? 1) : t.surface2,
                    }}
                  />
                ))}
              </View>
            ))}
          </View>
        </Card>
      </View>

      <Section>
        <RowList
          inset={space.md}
          rows={[
            ...(slot
              ? [
                  <ValueRow
                    key="busiest"
                    testID="rhythm-busiest"
                    title={i18n('riderInsights.detail.rhythm.busiest')}
                    value={slot}
                    textValue
                  />,
                ]
              : []),
            ...(typical
              ? [
                  <ValueRow
                    key="typical"
                    testID="rhythm-typical"
                    title={i18n('riderInsights.detail.rhythm.typical')}
                    caption={
                      detail.ridesWithMovingTime < detail.rides
                        ? i18n('riderInsights.detail.coverage', {
                            count: detail.ridesWithMovingTime,
                            total: detail.rides,
                          })
                        : null
                    }
                    value={typical}
                    textValue
                  />,
                ]
              : []),
          ]}
        />
      </Section>

      <Footnote>{i18n('riderInsights.detail.rhythm.footnote')}</Footnote>
    </>
  );
}
