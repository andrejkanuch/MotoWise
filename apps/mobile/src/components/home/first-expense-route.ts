import type { Href } from 'expo-router';
import { GARAGE_ROUTE, TAB_ROUTE } from '../../config/routes';

/** Where the `first_expense` checklist item routes (see resolveFirstExpenseRoute). */
export type FirstExpenseRoute =
  | { pathname: typeof GARAGE_ROUTE.EXPENSE_DASHBOARD; params: { motorcycleId: string } }
  | typeof GARAGE_ROUTE.ADD_BIKE
  | typeof TAB_ROUTE.GARAGE;

/**
 * Resolve where the `first_expense` checklist item should route. Expense screens
 * require a motorcycleId, so prefer the user's bike → expense dashboard (its empty
 * state + quick-add lead to the form). If the bikes query has resolved empty, send
 * them to add a bike; if it hasn't resolved yet (`bikesResolved` false), fall back
 * to the garage tab — never wrongly imply "no bikes" mid-load.
 */
export function resolveFirstExpenseRoute(args: {
  firstBikeId: string | undefined;
  bikesResolved: boolean;
}): FirstExpenseRoute {
  if (args.firstBikeId) {
    return {
      pathname: GARAGE_ROUTE.EXPENSE_DASHBOARD,
      params: { motorcycleId: args.firstBikeId },
    };
  }
  if (args.bikesResolved) return GARAGE_ROUTE.ADD_BIKE;
  return TAB_ROUTE.GARAGE;
}

/** The href form router.push consumes. */
export function firstExpenseHref(args: {
  firstBikeId: string | undefined;
  bikesResolved: boolean;
}): Href {
  return resolveFirstExpenseRoute(args) as Href;
}
