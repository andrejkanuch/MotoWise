// The season recap's data: which of the seven cards a rider sees in full, and
// the cost-of-riding figure per currency.
import { RiderInsightsStatus } from '@motovault/graphql';
import { freeInsights, newRiderInsights, proInsights } from '@/test/rider-insights-fixtures';
import {
  costOfRiding,
  formatCostPerUnit,
  RECAP_CARD,
  RECAP_STATE,
  RECAP_TIER,
  recapCards,
} from '../recap-model';

describe('recapCards', () => {
  it('gives a free rider three free cards in full and four Pro cards locked, in board order', () => {
    expect(recapCards(freeInsights())).toEqual([
      { card: RECAP_CARD.DISTANCE, tier: RECAP_TIER.FREE, state: RECAP_STATE.READY },
      { card: RECAP_CARD.COUNTRIES, tier: RECAP_TIER.FREE, state: RECAP_STATE.READY },
      { card: RECAP_CARD.LONGEST, tier: RECAP_TIER.FREE, state: RECAP_STATE.READY },
      { card: RECAP_CARD.RHYTHM, tier: RECAP_TIER.PRO, state: RECAP_STATE.LOCKED },
      { card: RECAP_CARD.NEW_ROADS, tier: RECAP_TIER.PRO, state: RECAP_STATE.LOCKED },
      { card: RECAP_CARD.TWISTIEST, tier: RECAP_TIER.PRO, state: RECAP_STATE.LOCKED },
      { card: RECAP_CARD.COST, tier: RECAP_TIER.PRO, state: RECAP_STATE.LOCKED },
    ]);
  });

  it('reads keep riding on every Pro card below five qualifying rides, never locked', () => {
    const pro = recapCards(newRiderInsights()).filter((c) => c.tier === RECAP_TIER.PRO);
    expect(pro.map((c) => c.state)).toEqual([
      RECAP_STATE.NOT_ENOUGH,
      RECAP_STATE.NOT_ENOUGH,
      RECAP_STATE.NOT_ENOUGH,
      // The fixture leaves cost locked; the API sends NOT_ENOUGH there too in practice.
      RECAP_STATE.LOCKED,
    ]);
  });

  it('shows the cost card as missing input when the season has no fuel or service spend', () => {
    const insights = {
      ...proInsights(),
      costPerKm: { status: RiderInsightsStatus.MissingInput, items: null },
    };
    const cost = recapCards(insights).find((c) => c.card === RECAP_CARD.COST);
    expect(cost?.state).toBe(RECAP_STATE.MISSING);
  });

  it('keeps the twistiest-ride card off "ready" when a Pro rider has no twistiest ride', () => {
    // proInsights() has road character ready but an empty twistiest list.
    const twisty = recapCards(proInsights()).find((c) => c.card === RECAP_CARD.TWISTIEST);
    expect(twisty?.state).toBe(RECAP_STATE.MISSING);
  });

  it('marks countries as computing while rides are pending and none is placed yet', () => {
    const insights = freeInsights({
      countries: [],
      coverage: { ...freeInsights().coverage, pendingRides: 3, pendingRecentRides: 3 },
    });
    expect(recapCards(insights).find((c) => c.card === RECAP_CARD.COUNTRIES)?.state).toBe(
      RECAP_STATE.COMPUTING,
    );
  });

  it('does not hold countries in computing for rides pending longer than a day', () => {
    // A ride whose stats keep failing must not block the card for the whole season.
    const insights = freeInsights({
      countries: [],
      coverage: { ...freeInsights().coverage, pendingRides: 1, pendingRecentRides: 0 },
    });
    expect(recapCards(insights).find((c) => c.card === RECAP_CARD.COUNTRIES)?.state).not.toBe(
      RECAP_STATE.COMPUTING,
    );
  });
});

describe('costOfRiding', () => {
  const eur = {
    currency: 'EUR',
    spend: 340,
    expenseCount: 12,
    distanceM: 2_400_000,
    distanceSource: 'odometer',
    costPerKm: 0.1417,
  };
  const usd = {
    currency: 'USD',
    spend: 45,
    expenseCount: 2,
    distanceM: 1_500_000,
    distanceSource: 'tracked',
    costPerKm: 0.03,
  };

  it("keeps the server's order (profile currency first), even when another currency has more spend", () => {
    // Amounts in different currencies are not comparable, so the API leads with
    // the rider's profile currency; the app must not re-sort by raw spend.
    const cost = costOfRiding([usd, eur], 'metric');
    expect(cost?.main.currency).toBe('USD');
    expect(cost?.others.map((o) => o.currency)).toEqual(['EUR']);
  });

  it('divides spend by distance in the rider unit: per mile for imperial riders', () => {
    // 340 over 2,400 km is 0.14167/km; 2,400 km is 1,491.29 mi, so 0.22799/mi.
    expect(costOfRiding([eur], 'metric')?.main.perUnit).toBeCloseTo(0.14167, 4);
    expect(costOfRiding([eur], 'imperial')?.main.perUnit).toBeCloseTo(0.22799, 4);
  });

  it('says which distance it divided by', () => {
    expect(costOfRiding([eur, usd], 'metric')?.main.source).toBe('odometer');
    expect(costOfRiding([usd], 'metric')?.main.source).toBe('tracked');
  });

  it('has no figure for a currency with no distance, and nothing at all with no rows', () => {
    expect(costOfRiding([{ ...eur, distanceM: 0, costPerKm: null }], 'metric')?.main.perUnit).toBe(
      null,
    );
    expect(costOfRiding([], 'metric')).toBeNull();
    expect(costOfRiding(null, 'metric')).toBeNull();
  });

  it('formats the figure in its currency per rider unit', () => {
    expect(formatCostPerUnit(0.14167, 'EUR', 'km', 'en')).toBe('€0.14/km');
    expect(formatCostPerUnit(0.03, 'USD', 'mi', 'en')).toBe('$0.03/mi');
  });
});
