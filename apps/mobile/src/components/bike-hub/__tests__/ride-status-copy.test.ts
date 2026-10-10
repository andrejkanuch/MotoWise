// ride-status-card imports the bike plate, which pulls in reanimated.
jest.mock('react-native-worklets', () => require('react-native-worklets/src/mock'));
jest.mock('react-native-reanimated', () => require('react-native-reanimated/mock'));
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));

import i18n from '@/i18n';
import { RIDE_STATUS_REASON } from '@/lib/bike-hub/constants';
import { getRideStatus, type RideStatusReason } from '@/lib/bike-hub/ride-status';
import {
  BIKE_A_DOCUMENTS,
  BIKE_A_TASKS,
  CATEGORIES,
  ECU_RECALL,
  KM,
} from '@/test/bike-hub-fixtures';
import { describeRideStatusReasons } from '../overview/ride-status-card';

const EN = 'en';
const DE = 'de';

const line = (reasons: readonly RideStatusReason[], language: string): string =>
  describeRideStatusReasons(reasons, i18n.getFixedT(language), language);

const recalls = (count: number): RideStatusReason => ({
  kind: RIDE_STATUS_REASON.OPEN_RECALLS,
  count,
});
const overdueHigh = (count: number): RideStatusReason => ({
  kind: RIDE_STATUS_REASON.OVERDUE_HIGH,
  count,
});
const overdueCritical = (count: number): RideStatusReason => ({
  kind: RIDE_STATUS_REASON.OVERDUE_CRITICAL,
  count,
});
const expiring = (categoryName: string, days: number): RideStatusReason => ({
  kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRING,
  categoryName,
  days,
});
const expired = (categoryName: string, days: number): RideStatusReason => ({
  kind: RIDE_STATUS_REASON.DOCUMENT_EXPIRED,
  categoryName,
  days,
});

describe('ride-status reasons — mid-sentence lower-casing', () => {
  it('the Africa Twin reads "1 open recall · 1 overdue high task · insurance expires in 12 days"', () => {
    const { reasons } = getRideStatus({
      tasks: BIKE_A_TASKS,
      documents: BIKE_A_DOCUMENTS,
      categories: CATEGORIES,
      recalls: [ECU_RECALL],
      ...KM,
    });
    expect(line(reasons, EN)).toBe(
      '1 open recall · 1 overdue high task · insurance expires in 12 days',
    );
  });

  it('a category that starts the line keeps its capital', () => {
    expect(line([expiring('Insurance', 12)], EN)).toBe('Insurance expires in 12 days');
    expect(line([expired('Registration', 3), recalls(1)], EN)).toBe(
      'Registration expired · 1 open recall',
    );
  });

  it('a category after the first fragment is lower-cased', () => {
    expect(line([overdueCritical(1), expired('Insurance', 3)], EN)).toBe(
      '1 overdue critical task · insurance expired',
    );
  });

  it('only the category is lower-cased: the first of two keeps its capital, the second does not', () => {
    expect(line([expired('Insurance', 3), expiring('Inspection', 5)], EN)).toBe(
      'Insurance expired · inspection expires in 5 days',
    );
  });

  it('German keeps the noun’s capital mid-sentence', () => {
    expect(line([recalls(1), overdueHigh(1), expiring('Versicherung', 12)], DE)).toBe(
      '1 offener Rückruf · 1 überfällige Aufgabe mit hoher Priorität · Versicherung läuft in 12 Tagen ab',
    );
  });

  it('German leaves a category exactly as stored, in any position', () => {
    expect(line([overdueCritical(2), expired('Insurance', 3)], DE)).toBe(
      '2 überfällige kritische Aufgaben · Insurance abgelaufen',
    );
    expect(line([expired('Insurance', 3)], DE)).toBe('Insurance abgelaufen');
  });
});

describe('ride-status reasons — counts and days', () => {
  it.each([
    [recalls(1), '1 open recall'],
    [recalls(2), '2 open recalls'],
    [overdueHigh(1), '1 overdue high task'],
    [overdueHigh(3), '3 overdue high tasks'],
    [overdueCritical(1), '1 overdue critical task'],
    [overdueCritical(2), '2 overdue critical tasks'],
    [expiring('Insurance', 0), 'Insurance expires today'],
    [expiring('Insurance', 1), 'Insurance expires in 1 day'],
    [expiring('Insurance', 30), 'Insurance expires in 30 days'],
    [expired('Insurance', 1), 'Insurance expired'],
  ])('%j reads "%s"', (reason, text) => {
    expect(line([reason], EN)).toBe(text);
  });

  it('no reasons, no line', () => {
    expect(line([], EN)).toBe('');
  });
});
