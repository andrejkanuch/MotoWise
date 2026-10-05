import { UpdateUserDocument } from '@motovault/graphql';
import { captureException } from './analytics';
import {
  type AccountPrivacyPreference,
  buildPrivacyUpdate,
  type ConsentDecision,
} from './analytics-consent';
import { gqlFetcher } from './graphql-client';

/**
 * Save an analytics decision to the signed-in account, versioned so later
 * launches (and other devices) can trust it — see `accountConsentDecision`.
 *
 * The whole `privacy` object is sent (see buildPrivacyUpdate); `current`
 * carries the other privacy keys through unchanged.
 * Best-effort: a failed write is reported and the device keeps its decision.
 * Resolves true when saved, so callers refetch only after a real change (a
 * refetch after a failure would retry in a loop).
 */
export async function saveConsentToAccount(
  decision: ConsentDecision,
  current: AccountPrivacyPreference | null | undefined,
): Promise<boolean> {
  const privacy = buildPrivacyUpdate(current, { analytics: decision });
  try {
    await gqlFetcher(UpdateUserDocument, { input: { preferences: { privacy } } });
    return true;
  } catch (e) {
    captureException(e, { source: 'consent-account-sync.saveConsentToAccount' });
    return false;
  }
}
