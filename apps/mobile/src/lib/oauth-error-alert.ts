// The one place a failed Apple/Google sign-in is shown to the rider. Every sign-in
// surface reaches it through `useOAuthSignIn`, so a classification change (oauth.ts)
// reaches all of them and none can drift into alerting on a double tap or reporting
// an expected outcome as a bug.
import { Alert } from 'react-native';
import i18n from '../i18n';
import { captureException } from './analytics';
import { userFriendlyError } from './graphql-errors';
import { classifyOAuthError, OAUTH_ERROR_KIND, type OAuthErrorKind } from './oauth';

const showError = (message: string) => Alert.alert(i18n.t('common.error'), message);

const PRESENT: Record<OAuthErrorKind, (err: unknown) => void> = {
  // The first sign-in is still on screen and will finish on its own.
  [OAUTH_ERROR_KIND.inProgress]: () => {},
  [OAUTH_ERROR_KIND.noPlayServices]: () => showError(i18n.t('auth.googlePlayServicesUnavailable')),
  // Not reported: a device that refuses the sheet is not something a release can fix.
  [OAUTH_ERROR_KIND.cannotPresent]: () => showError(i18n.t('auth.googleSignInCannotOpen')),
  [OAUTH_ERROR_KIND.expected]: (err) => showError(userFriendlyError(err)),
  [OAUTH_ERROR_KIND.unexpected]: (err) => {
    captureException(err);
    showError(userFriendlyError(err));
  },
};

export function presentOAuthError(err: unknown): void {
  PRESENT[classifyOAuthError(err)](err);
}
