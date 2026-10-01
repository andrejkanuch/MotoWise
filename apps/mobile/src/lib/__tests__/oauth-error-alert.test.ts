jest.mock('../../i18n', () => ({ __esModule: true, default: { t: (k: string) => k } }));
jest.mock('../analytics', () => ({ captureException: jest.fn() }));
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
import { captureException } from '../analytics';
import { classifyOAuthError, OAUTH_ERROR_KIND } from '../oauth';
import { presentOAuthError } from '../oauth-error-alert';

const classify = classifyOAuthError as jest.Mock;

const alertSpy = jest.spyOn(Alert, 'alert').mockImplementation(() => {});

beforeEach(() => jest.clearAllMocks());

describe('presentOAuthError', () => {
  it('stays silent on a double tap: no alert, no report', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.inProgress);
    presentOAuthError(new Error('x'));
    expect(alertSpy).not.toHaveBeenCalled();
    expect(captureException).not.toHaveBeenCalled();
  });

  it('guides a device without Play services to email, without reporting', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.noPlayServices);
    presentOAuthError(new Error('x'));
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'auth.googlePlayServicesUnavailable');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('alerts but does not report an expected outcome', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.expected);
    presentOAuthError(new Error('x'));
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'friendly');
    expect(captureException).not.toHaveBeenCalled();
  });

  it('reports and alerts an unexpected failure', () => {
    classify.mockReturnValue(OAUTH_ERROR_KIND.unexpected);
    const err = new Error('boom');
    presentOAuthError(err);
    expect(captureException).toHaveBeenCalledWith(err);
    expect(alertSpy).toHaveBeenCalledWith('common.error', 'friendly');
  });
});
