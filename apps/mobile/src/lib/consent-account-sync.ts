import { UpdateUserDocument } from '@motovault/graphql';
import { captureException } from './analytics';
import { type AccountPrivacyPreference, CONSENT_VERSION } from './analytics-consent';
import { gqlFetcher } from './graphql-client';

/**
 * Save an analytics decision to the signed-in account, versioned so later
 * launches (and other devices) can trust it — see `accountConsentDecision`.
 *
 * `preferences` merges one level deep on the server, so the whole `privacy`
 * object is sent; `current` carries the other privacy keys through unchanged.
 * Best-effort: a failed write is reported and the device keeps its decision.
 */
export async function saveConsentToAccount(
  enabled: boolean,
  current: AccountPrivacyPreference | null | undefined,
): Promise<void> {
  const privacy = {
    analyticsEnabled: enabled,
    crashReportingEnabled:
      typeof current?.crashReportingEnabled === 'boolean' ? current.crashReportingEnabled : true,
    consentVersion: CONSENT_VERSION,
  };
  try {
    await gqlFetcher(UpdateUserDocument, { input: { preferences: { privacy } } });
  } catch (e) {
    captureException(e, { source: 'consent-account-sync.saveConsentToAccount' });
  }
}
