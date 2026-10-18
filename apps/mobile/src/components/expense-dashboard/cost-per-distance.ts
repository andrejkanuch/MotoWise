/**
 * All-time spend per odometer unit. The odometer is stored raw in the rider's
 * measurement-system unit, so the result is per mi or per km to match the label.
 *
 * The bike's own `currentMileage` (from the garage list) wins; the route param is
 * only a fallback while that list loads, so every entry point gets a value, not
 * just the ones that pass the odometer along.
 */
export function costPerDistance(
  allTimeTotal: number,
  bikeMileage: number | null | undefined,
  paramMileage: string | undefined,
): number | null {
  const mileage = bikeMileage ?? (paramMileage ? Number(paramMileage) : null);
  if (mileage == null || !Number.isFinite(mileage) || mileage <= 0) return null;
  return allTimeTotal / mileage;
}
