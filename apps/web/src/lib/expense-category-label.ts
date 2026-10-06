/**
 * Maps an expense category key (`taxes_fees`) to its `Garage` message key
 * (`catTaxesFees`).
 *
 * Category keys come from `EXPENSE_CATEGORY_META` in @motovault/types and are
 * snake_case DB values; message keys are camelCase. The old inline mapping only
 * upper-cased the first letter, which produced `catTaxes_fees`, and nothing
 * checked that the key existed — so the dashboard printed the raw key
 * `Garage.catTaxes_fees`. `expense-category-label.test.ts` now asserts every
 * category in the shared enum has a key in every locale with a `Garage` section.
 */
export function expenseCategoryMessageKey(category: string): `cat${string}` {
  const pascal = category
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join('');
  return `cat${pascal}`;
}
