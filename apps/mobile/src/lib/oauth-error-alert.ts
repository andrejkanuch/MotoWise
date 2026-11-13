// The one place a failed Apple/Google sign-in is shown to the rider. Every sign-in
// surface reaches it through `useOAuthSignIn`, so a classification change (oauth.ts)
// reaches all of them and none can drift into alerting on a double tap or reporting
// an expected outcome as a bug.
import { Alert } from 'react-native';
import type { AuthMethod } from '../config/auth';
import i18n from '../i18n';
import { AnalyticsEvent, captureException, trackEvent } from './analytics';
import { userFriendlyError } from './graphql-errors';
import {
  classifyOAuthError,
  OAUTH_ERROR_KIND,
  OAUTH_KIND_OUTCOME,
  type OAuthErrorKind,
  oauthErrorCode,
} from './oauth';

type ShowError = (message: string) => void;

const PRESENT: Record<OAuthErrorKind, (err: unknown, show: ShowError) => void> = {
  // The first sign-in is still on screen and will finish on its own.
  [OAUTH_ERROR_KIND.inProgress]: () => {},
  [OAUTH_ERROR_KIND.noPlayServices]: (_err, show) =>
    show(i18n.t('auth.googlePlayServicesUnavailable')),
  // Not reported: a device that refuses the sheet is not something a release can fix.
  [OAUTH_ERROR_KIND.cannotPresent]: (_err, show) => show(i18n.t('auth.googleSignInCannotOpen')),
  // The rider closed the sheet on purpose: nothing to tell them (issue 365 T12, FS-OB2c).
  // `useOAuthSignIn` already skips this call on a cancel; this keeps any other caller silent too.
  [OAUTH_ERROR_KIND.expected]: () => {},
  [OAUTH_ERROR_KIND.unexpected]: (err, show) => {
    captureException(err);
    show(userFriendlyError(err));
  },
};

/**
 * Alerts (and reports, when it is a bug) a failed sign-in with `provider`. Every
 * alert shown is also one `auth_error_alert_shown` {provider, outcome, error_code}
 * (issue 365 T04a, FS-OB2c): the error's code only, never its message.
 */
export function presentOAuthError(err: unknown, provider: AuthMethod): void {
  const kind = classifyOAuthError(err);
  PRESENT[kind](err, (message) => {
    trackEvent(AnalyticsEvent.AUTH_ERROR_ALERT_SHOWN, {
      provider,
      outcome: OAUTH_KIND_OUTCOME[kind],
      error_code: oauthErrorCode(err),
    });
    Alert.alert(i18n.t('common.error'), message);
  });
}
