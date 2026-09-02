/**
 * Single source of truth for expense categories.
 *
 * Everything that needs the category list derives from EXPENSE_CATEGORY_META:
 * the Zod enum (validators/expense.ts), the mobile colour/label maps
 * (apps/mobile/src/lib/expense-constants.ts), the seed script, etc.
 *
 * The ONLY unavoidable duplication is the DB `chk_expenses_category` CHECK
 * constraint (SQL cannot import TS) — keep migrations in sync with these keys.
 *
 * `colorToken` is a string key into @motovault/design-system's `palette`,
 * resolved in the mobile layer. This package must stay dependency-light (zod
 * only), so it never imports the design system at runtime.
 */
export interface ExpenseCategoryMeta {
  /** Stable machine key — persisted to the DB `category` column. Never rename. */
  readonly key: string;
  /** Default English label. UI overrides via i18n key `expenses.category_<key>`. */
  readonly label: string;
  /** Key into the design-system `palette` for this category's accent colour. */
  readonly colorToken: string;
  /** Whether the category shows in the primary chip row by default. */
  readonly primary: boolean;
  /**
   * Does this spend go INTO the machine, or is it the price of using it?
   *
   * `true`  — money the bike still carries: parts, tyres, service history, mods.
   * `false` — consumed by riding and unrecoverable at resale: fuel, tolls,
   *           parking, taxes & fees.
   *
   * Drives the "Invested in bike" vs "Cost of riding" split on the expense
   * dashboard. Riders asked for it to price a bike they are selling — a rider
   * with a VTX1800R put it plainly: fuel "doesn't add any value to the bike…
   * that is just a part of riding".
   *
   * This is a *presentation* split, not an accounting one. Total cost of
   * ownership still sums everything; nothing is hidden. Flipping a flag here
   * re-buckets that category everywhere the split is shown, with no migration —
   * the totals are derived from the dashboard's all-time `categoryTotals`.
   */
  readonly investment: boolean;
}

export const EXPENSE_CATEGORY_META = [
  { key: 'fuel', label: 'Fuel', colorToken: 'warning500', primary: true, investment: false },
  {
    key: 'maintenance',
    label: 'Service',
    colorToken: 'primary500',
    primary: true,
    investment: true,
  },
  { key: 'parts', label: 'Parts', colorToken: 'accent500', primary: true, investment: true },
  { key: 'tires', label: 'Tires', colorToken: 'danger500', primary: true, investment: true },
  { key: 'gear', label: 'Gear', colorToken: 'signature500', primary: true, investment: true },
  {
    key: 'accessories',
    label: 'Accessories',
    colorToken: 'accent400',
    primary: false,
    investment: true,
  },
  {
    key: 'modifications',
    label: 'Mods',
    colorToken: 'moduleEngine',
    primary: false,
    investment: true,
  },
  {
    key: 'insurance',
    label: 'Insurance',
    colorToken: 'indigo500',
    primary: false,
    investment: true,
  },
  {
    key: 'registration',
    label: 'Registration',
    colorToken: 'moduleSuspension',
    primary: false,
    investment: true,
  },
  {
    key: 'taxes_fees',
    label: 'Taxes & Fees',
    colorToken: 'signature600',
    primary: false,
    investment: false,
  },
  { key: 'tolls', label: 'Tolls', colorToken: 'neutral500', primary: false, investment: false },
  { key: 'parking', label: 'Parking', colorToken: 'indigo400', primary: false, investment: false },
  {
    key: 'training',
    label: 'Training',
    colorToken: 'success500',
    primary: false,
    investment: true,
  },
  { key: 'other', label: 'Other', colorToken: 'neutral400', primary: false, investment: true },
] as const satisfies readonly ExpenseCategoryMeta[];

export type ExpenseCategory = (typeof EXPENSE_CATEGORY_META)[number]['key'];

/** Category keys consumed by riding rather than retained by the bike. */
export const CONSUMABLE_EXPENSE_CATEGORIES: readonly string[] = EXPENSE_CATEGORY_META.filter(
  (m) => !m.investment,
).map((m) => m.key);

/**
 * Whether spend in `category` counts toward "Invested in bike".
 *
 * Unknown keys count as investment. A category retired from the meta table
 * still has rows in the DB, and silently dropping them would make the split
 * stop reconciling with the total cost of ownership shown right above it —
 * a number that quietly loses money is worse than one that over-counts.
 */
export function isInvestmentCategory(category: string): boolean {
  return !CONSUMABLE_EXPENSE_CATEGORIES.includes(category);
}

/**
 * Splits all-time category totals into what the bike kept and what riding used.
 *
 * Takes the dashboard's `categoryTotals`, which is already all-time and sums to
 * `allTimeTotal`, so `invested + consumed === allTimeTotal` by construction.
 * `purchasePrice` is part of the investment because it is the largest sum the
 * machine actually carries.
 */
export function splitExpenseTotals(
  categoryTotals: readonly { category: string; total: number }[],
  purchasePrice = 0,
): { invested: number; consumed: number } {
  let invested = purchasePrice;
  let consumed = 0;
  for (const { category, total } of categoryTotals) {
    if (isInvestmentCategory(category)) invested += total;
    else consumed += total;
  }
  return { invested, consumed };
}

/** Ordered tuple of category keys — shaped for `z.enum()`. */
export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_META.map((m) => m.key) as [
  ExpenseCategory,
  ...ExpenseCategory[],
];
