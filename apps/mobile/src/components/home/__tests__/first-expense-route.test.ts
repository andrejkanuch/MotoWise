// MOT-269 code-review gap: the first_expense checklist item's 3-way routing is
// activation-critical and was untested. Pin each branch so a regression can't
// silently strand a user mid-load or wrongly imply "no bikes".

import { GARAGE_ROUTE, TAB_ROUTE } from '../../../config/routes';
import { resolveFirstExpenseRoute } from '../first-expense-route';

describe('resolveFirstExpenseRoute', () => {
  it('routes to the expense dashboard for the resolved bike when one exists', () => {
    const route = resolveFirstExpenseRoute({ firstBikeId: 'bike-1', bikesResolved: true });
    expect(route).toEqual({
      pathname: GARAGE_ROUTE.EXPENSE_DASHBOARD,
      params: { motorcycleId: 'bike-1' },
    });
  });

  it('routes to add-bike when bikes are resolved but empty', () => {
    const route = resolveFirstExpenseRoute({ firstBikeId: undefined, bikesResolved: true });
    expect(route).toBe(GARAGE_ROUTE.ADD_BIKE);
  });

  it('falls back to the garage tab while bikes are still loading (never implies no-bikes)', () => {
    const route = resolveFirstExpenseRoute({ firstBikeId: undefined, bikesResolved: false });
    expect(route).toBe(TAB_ROUTE.GARAGE);
  });

  it('prefers the bike route even mid-load once a firstBikeId is present', () => {
    // firstBikeId present but bikesResolved still false (data just arrived) — the
    // bike branch wins; we never send a user with a bike to add-bike or the bare tab.
    const route = resolveFirstExpenseRoute({ firstBikeId: 'bike-9', bikesResolved: false });
    expect(route).toEqual({
      pathname: GARAGE_ROUTE.EXPENSE_DASHBOARD,
      params: { motorcycleId: 'bike-9' },
    });
  });
});
