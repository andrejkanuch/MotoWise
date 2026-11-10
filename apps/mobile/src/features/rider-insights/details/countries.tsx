import type { MeasurementSystem } from '@motovault/types';
import { useTranslation } from 'react-i18next';
import { Text, View } from 'react-native';
import { useEditorialTheme } from '@/theme/editorial';
import { space } from '@/theme/spacing';
import { type } from '@/theme/type';
import { plateLettersFor } from '../country-codes';
import { formatInsightDistance, type RiderInsightsData } from '../use-rider-insights';
import { shortDate } from './detail-format';
import { DetailHero, Footnote, openRide, RowList, ValueRow } from './detail-parts';

type Country = RiderInsightsData['countries'][number];

const OVAL_HEIGHT = 24;
const OVAL_WIDTH = 44;
const OVAL_KEYLINE = 1.5;
const OVAL_TEXT = { fontSize: 15, lineHeight: 18 } as const;
const PLATE_MAX_FONT_SCALE = 1.2;

/** Separator inset for rows that lead with an oval. */
const OVAL_ROW_INSET = space.md + OVAL_WIDTH + space.sm;

/** A country's oval registration sticker: plate ink on bone, keylined on light grounds. */
function CountryOval({ isoA2 }: { isoA2: string }) {
  const { t, isDark } = useEditorialTheme();
  return (
    <View
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
      style={{
        width: OVAL_WIDTH,
        height: OVAL_HEIGHT,
        borderRadius: OVAL_HEIGHT / 2,
        borderCurve: 'continuous',
        backgroundColor: t.plateReady,
        borderWidth: isDark ? 0 : OVAL_KEYLINE,
        borderColor: t.onPlate,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <Text
        style={[type.figureSmall, OVAL_TEXT, { color: t.onPlate }]}
        maxFontSizeMultiplier={PLATE_MAX_FONT_SCALE}
      >
        {plateLettersFor(isoA2)}
      </Text>
    </View>
  );
}

/** Countries (free): each country with the date it was first ridden and the distance in it. Opens that first ride. */
export function CountriesDetail({
  countries,
  system,
}: {
  countries: readonly Country[];
  system: MeasurementSystem;
}) {
  const { t: i18n, i18n: instance } = useTranslation();
  const language = instance.language;
  const ordered = [...countries].sort((a, b) => a.firstDate.localeCompare(b.firstDate));

  return (
    <>
      <DetailHero
        figure={String(countries.length)}
        line={i18n('riderInsights.detail.countries.heroLine', { count: countries.length })}
      />
      <RowList
        inset={OVAL_ROW_INSET}
        rows={ordered.map((country) => (
          <ValueRow
            key={country.isoA2}
            testID={`country-${country.isoA2}`}
            leading={<CountryOval isoA2={country.isoA2} />}
            title={country.name ?? country.isoA2}
            caption={i18n('riderInsights.detail.countries.meta', {
              count: country.rides,
              date: shortDate(country.firstDate, language),
            })}
            value={formatInsightDistance(country.distanceM, system, language)}
            onPress={() => openRide(country.firstRideId)}
          />
        ))}
      />
      <Footnote>{i18n('riderInsights.detail.countries.footnote')}</Footnote>
    </>
  );
}
