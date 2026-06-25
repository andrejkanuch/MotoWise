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
}

export const EXPENSE_CATEGORY_META = [
  { key: 'fuel', label: 'Fuel', colorToken: 'warning500', primary: true },
  { key: 'maintenance', label: 'Service', colorToken: 'primary500', primary: true },
  { key: 'parts', label: 'Parts', colorToken: 'accent500', primary: true },
  { key: 'tires', label: 'Tires', colorToken: 'danger500', primary: true },
  { key: 'gear', label: 'Gear', colorToken: 'signature500', primary: true },
  { key: 'accessories', label: 'Accessories', colorToken: 'accent400', primary: false },
  { key: 'modifications', label: 'Mods', colorToken: 'moduleEngine', primary: false },
  { key: 'insurance', label: 'Insurance', colorToken: 'indigo500', primary: false },
  { key: 'registration', label: 'Registration', colorToken: 'moduleSuspension', primary: false },
  { key: 'taxes_fees', label: 'Taxes & Fees', colorToken: 'signature600', primary: false },
  { key: 'tolls', label: 'Tolls', colorToken: 'neutral500', primary: false },
  { key: 'parking', label: 'Parking', colorToken: 'indigo400', primary: false },
  { key: 'training', label: 'Training', colorToken: 'success500', primary: false },
  { key: 'other', label: 'Other', colorToken: 'neutral400', primary: false },
] as const satisfies readonly ExpenseCategoryMeta[];

export type ExpenseCategory = (typeof EXPENSE_CATEGORY_META)[number]['key'];

/** Ordered tuple of category keys — shaped for `z.enum()`. */
export const EXPENSE_CATEGORIES = EXPENSE_CATEGORY_META.map((m) => m.key) as [
  ExpenseCategory,
  ...ExpenseCategory[],
];
