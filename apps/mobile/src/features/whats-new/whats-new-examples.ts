import { Currency, type ExpenseCategory, MeasurementSystem } from '@motovault/types';

/**
 * Example data for What's New pages when the rider has none of their own. It is
 * always shown labelled EXAMPLE, never worded as the rider's data, and never
 * taken from another rider.
 */

/** A route as `[lat, lng]` pairs. */
export type RoutePath = ReadonlyArray<readonly [number, number]>;

/**
 * Three short loops for the example atlas. They are abstract shapes in degrees
 * around an empty point of ocean, not a real place or anyone's ride; the demo
 * fits them to its frame.
 */
export const EXAMPLE_ROUTES: readonly RoutePath[] = [
  [
    [0, 0],
    [0.04, 0.03],
    [0.09, 0.04],
    [0.13, 0.09],
    [0.15, 0.16],
    [0.12, 0.22],
  ],
  [
    [0, 0],
    [-0.03, 0.06],
    [-0.02, 0.13],
    [0.03, 0.19],
    [0.08, 0.24],
  ],
  [
    [0, 0],
    [0.05, -0.04],
    [0.1, -0.05],
    [0.16, -0.02],
    [0.2, 0.04],
    [0.19, 0.1],
  ],
];

/**
 * A typical motorcycle fuel fill (about 12-14 litres) in each app currency, as
 * a receipt would print it. Round-ish local prices, not live fuel prices.
 */
export const EXAMPLE_FUEL_FILL: Record<Currency, number> = {
  [Currency.USD]: 18.42,
  [Currency.EUR]: 23.47,
  [Currency.GBP]: 19.64,
  [Currency.JPY]: 2_380,
  [Currency.CAD]: 23.9,
  [Currency.AUD]: 27.45,
  [Currency.CHF]: 24.6,
  [Currency.INR]: 1_310,
  [Currency.BRL]: 82.5,
  [Currency.MXN]: 318.4,
  [Currency.SEK]: 236.8,
  [Currency.NOK]: 262.4,
  [Currency.DKK]: 171.5,
  [Currency.PLN]: 84.7,
  [Currency.TRY]: 640,
  [Currency.RSD]: 2_480,
  [Currency.CZK]: 512,
  [Currency.HUF]: 8_450,
  [Currency.RON]: 104.6,
  [Currency.BGN]: 39.8,
  [Currency.COP]: 72_500,
  [Currency.ARS]: 24_800,
  [Currency.CLP]: 17_900,
  [Currency.PEN]: 68.4,
  [Currency.KES]: 2_460,
  [Currency.PHP]: 860,
};

/**
 * For a currency code the app does not know. No per-currency expense limit
 * exists to scale from (the only cap is the column maximum, the same for every
 * currency), so the example falls back to the US fill in dollars rather than
 * printing a dollar-sized number in an unknown currency.
 */
export const FALLBACK_FUEL_FILL = {
  currency: Currency.USD,
  amount: EXAMPLE_FUEL_FILL[Currency.USD],
} as const;

/** The example fuel fill in `currency`, or the documented fallback for an unknown code. */
export function exampleFuelFill(currency: string): { currency: Currency; amount: number } {
  return currency in EXAMPLE_FUEL_FILL
    ? { currency: currency as Currency, amount: EXAMPLE_FUEL_FILL[currency as Currency] }
    : FALLBACK_FUEL_FILL;
}

/** The example receipt's category; typed, so a renamed category fails the build. */
export const EXAMPLE_RECEIPT_CATEGORY = 'fuel' as const satisfies ExpenseCategory;

/** The example receipt is dated this many days before today. */
export const EXAMPLE_RECEIPT_DAYS_AGO = 3;

export const PRESSURE_UNIT = {
  BAR: 'bar',
  PSI: 'psi',
} as const;

export type PressureUnit = (typeof PRESSURE_UNIT)[keyof typeof PRESSURE_UNIT];

/**
 * Typical road-bike tire pressures for the example note, in bar for metric
 * riders and psi for imperial ones.
 */
export const EXAMPLE_TIRE_PRESSURE: Record<
  MeasurementSystem,
  { unit: PressureUnit; front: number; rear: number; fractionDigits: number }
> = {
  [MeasurementSystem.METRIC]: { unit: PRESSURE_UNIT.BAR, front: 2.5, rear: 2.9, fractionDigits: 1 },
  [MeasurementSystem.IMPERIAL]: { unit: PRESSURE_UNIT.PSI, front: 36, rear: 42, fractionDigits: 0 },
};
