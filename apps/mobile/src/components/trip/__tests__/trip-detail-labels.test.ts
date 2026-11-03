import i18next, { type TFunction } from 'i18next';
import en from '../../../i18n/locales/en.json';
import es from '../../../i18n/locales/es.json';
import pl from '../../../i18n/locales/pl.json';
import {
  tripDayHeader,
  tripDifficultyLabel,
  tripPeriodLabel,
  tripSurfaceLabel,
  tripVisibilityLabel,
} from '../trip-detail-labels';

async function tFor(lng: string): Promise<TFunction> {
  const instance = i18next.createInstance();
  await instance.init({
    lng,
    fallbackLng: 'en',
    resources: {
      en: { translation: en },
      es: { translation: es },
      pl: { translation: pl },
    },
    interpolation: { escapeValue: false },
    showSupportNotice: false,
  });
  return instance.t;
}

describe('trip detail labels', () => {
  it('reads difficulty, surface and visibility in the app language', async () => {
    const t = await tFor('es');

    expect(tripDifficultyLabel(t, 'challenging')).toBe(es.trips.difficultyChallenging);
    expect(tripDifficultyLabel(t, 'CHALLENGING')).toBe(es.trips.difficultyChallenging);
    expect(tripSurfaceLabel(t, 'off_road')).toBe(es.trips.surfaceOffRoad);
    expect(tripVisibilityLabel(t, 'private')).toBe(es.trips.visibilityChipPrivate);
    expect(tripPeriodLabel(t, 'morning')).toBe(es.tripSuggestions.period.morning);
  });

  it('falls back sensibly for values this build does not know', async () => {
    const t = await tFor('en');

    expect(tripDifficultyLabel(t, null)).toBe('Chill');
    expect(tripDifficultyLabel(t, 'insane')).toBe('Chill');
    expect(tripSurfaceLabel(t, 'sand')).toBe('sand');
    expect(tripVisibilityLabel(t, undefined)).toBe('Private');
  });

  it('heads a day with its date only when the trip has one', async () => {
    const t = await tFor('en');

    expect(tripDayHeader(t, 1, null, 'en')).toBe('Day 2');
    expect(tripDayHeader(t, 1, '2026-06-14T12:00:00.000Z', 'en')).toBe('Day 2 · Jun 15');
  });

  it('pluralises stop counts with the locale’s own forms', async () => {
    const t = await tFor('pl');

    expect(t('trips.stopCount', { count: 1 })).toBe('1 przystanek');
    expect(t('trips.stopCount', { count: 3 })).toBe('3 przystanki');
    expect(t('trips.stopCount', { count: 5 })).toBe('5 przystanków');
  });
});
