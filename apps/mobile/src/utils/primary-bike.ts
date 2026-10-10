/** The rider's primary bike, or the first one when none is flagged. `undefined` for an empty list. */
export function selectPrimaryBike<T extends { isPrimary: boolean }>(bikes: readonly T[]) {
  return bikes.find((b) => b.isPrimary) ?? bikes[0];
}
