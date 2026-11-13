jest.mock('../../i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('../analytics', () => ({
  captureException: jest.fn(),
  trackEvent: jest.fn(),
  AnalyticsEvent: new Proxy({}, { get: (_t, prop) => String(prop) }),
}));
jest.mock('../graphql-errors', () => ({ userFriendlyError: () => 'friendly' }));
jest.mock('../oauth', () => {
  const actual = jest.requireActual('../oauth');
  return { ...actual, classifyOAuthError: jest.fn() };
});
jest.mock('@react-native-google-signin/google-signin', () => ({
  GoogleSignin: { configure: jest.fn() },
  isSuccessResponse: jest.fn(),
  isErrorWithCode: () => false,
  statusCodes: { IN_PROGRESS: 'IN_PROGRESS', PLAY_SERVICES_NOT_AVAILABLE: 'PSNA' },
}));
jest.mock('expo-apple-authentication', () => ({}));
jest.mock('expo-crypto', () => ({}));
jest.mock('../supabase', () => ({ supabase: { auth: {} } }));

import { Alert } from 'react-native';
import { AUTH_METHOD } from '../../config/auth';
import { captureException, trackEvent } from '../analytics';
import { classifyOAuthError, OAUTH_ERROR_KIND } from '../oauth';
import { presentOAuthError } from '../oauth-error-alert';

const classify = classifyOAuthError as jest.Mock;
const track = trackEvent as jest.Mock;

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => jest.clearAllMocks());

/** An error carrying a code, as the provider SDKs throw them. */
const coded = (code: string) => Object.assign(new Error('a long native message'), { code });

describe('presentOAuthError', () => {
  it('stays silent on a double tap: no alert, no report, no alert event', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.inProgress);
    presentOAuthError(new Error('x'), AUTH_METHOD.GOOGLE);
    expect(alertSpy).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
    expect(track).not.toHaveBeenCalled();
  });

  it('guides a device without Play services to email, without reporting', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.noPlayServices);
    presentOAuthError(coded('PLAY_SERVICES_NOT_AVAILABLE'), AUTH_METHOD.GOOGLE);
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'auth.googlePlayServicesUnavailable');
    expect(captureException).not.toHaveBeenCalled();
    expect(track.mock.calls).toEqual([
      [
        'AUTH_ERROR_ALERT_SHOWN',
        {
          provider: 'google',
          outcome: 'no_play_services',
          error_code: 'PLAY_SERVICES_NOT_AVAILABLE',
        },
      ],
    ]);
  });

  it('tells the rider the Google sheet could not open, without reporting', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.cannotPresent);
    presentOAuthError(new Error('x'), AUTH_METHOD.GOOGLE);
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'auth.googleSignInCannotOpen');
    expect(captureException).not.toHaveBeenCalled();
    expect(track.mock.calls).toEqual([
      [
        'AUTH_ERROR_ALERT_SHOWN',
        { provider: 'google', outcome: 'cannot_present', error_code: 'Error' },
      ],
    ]);
  });

  it('alerts but does not report an expected outcome (a cancel)', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.expected);
    presentOAuthError(coded('ERR_REQUEST_CANCELED'), AUTH_METHOD.APPLE);
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'friendly');
    expect(captureException).not.toHaveBeenCalled();
    expect(track.mock.calls).toEqual([
      [
        'AUTH_ERROR_ALERT_SHOWN',
        { provider: 'apple', outcome: 'cancelled', error_code: 'ERR_REQUEST_CANCELED' },
      ],
    ]);
  });

  it('reports and alerts an unexpected failure', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.unexpected);
    const err = new Error('boom');
    presentOAuthError(err, AUTH_METHOD.APPLE);
    expect(captureException).toHaveBeenCalledWith(err);
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'friendly');
    expect(track.mock.calls).toEqual([
      ['AUTH_ERROR_ALERT_SHOWN', { provider: 'apple', outcome: 'error', error_code: 'Error' }],
    ]);
  });

  it('never puts the error message in the event, and drops a code that is not a plain token', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.unexpected);
    presentOAuthError(coded('rider@example.com could not sign in'), AUTH_METHOD.GOOGLE);
    expect(track.mock.calls).toEqual([
      ['AUTH_ERROR_ALERT_SHOWN', { provider: 'google', outcome: 'error', error_code: null }],
    ]);
    expect(JSON.stringify(track.mock.calls)).not.toContain('native message');
  });
});
