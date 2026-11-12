/** The bike fields the server-side recall lookup reads. */
export interface RecallLookupFields {
  make?: string | null;
  model?: string | null;
  year?: number | null;
  vin?: string | null;
}

const hasText = (value: string | null | undefined): boolean => !!value?.trim();

/**
 * Whether the `motorcycleRecalls` query can answer for this bike. Mirrors the
 * API rule (`NhtsaService.getRecalls`): a lookup needs make, model and year, or
 * a VIN to decode them from. Without either the API answers 422
 * UNPROCESSABLE_ENTITY, so the client asks the rider for the details instead of
 * sending a request that is certain to fail (Sentry MOTO-VAULT-REACT-NATIVE-42).
 *
 * A VIN counts even with blank fields: only the server can tell whether it
 * decodes. An undecodable one still ends in the 422, which the recalls UI
 * explains and the Sentry filter drops as an expected business rule.
 */
export function canCheckRecalls(bike: RecallLookupFields): boolean {
  if (hasText(bike.vin)) return true;
  return hasText(bike.make) && hasText(bike.model) && !!bike.year;
}
