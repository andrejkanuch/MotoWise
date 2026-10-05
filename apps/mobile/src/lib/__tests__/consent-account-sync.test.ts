const mockGqlFetcher = jest.fn();
const mockCaptureException = jest.fn();

jest.mock('../graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockGqlFetcher(...args),
}));
jest.mock('../analytics', () => ({
  captureException: (...args: unknown[]) => mockCaptureException(...args),
}));
jest.mock('@motovault/graphql', () => ({ UpdateUserDocument: 'UpdateUserDocument' }));
jest.mock('../secure-store', () => ({
  SECURE_STORE_KEY: { ANALYTICS_CONSENT: 'motovault.analytics-consent' },
  SECURE_STORE_STATUS: { OK: 'ok' },
}));
jest.mock('expo-localization', () => ({ getLocales: () => [] }));

import { saveConsentToAccount } from '../consent-account-sync';

beforeEach(() => {
  jest.clearAllMocks();
});

describe('saveConsentToAccount', () => {
  it('saves the whole privacy object: the timestamped decision plus the other keys as stored', async () => {
    mockGqlFetcher.mockResolvedValue({});
    const saved = await saveConsentToAccount(
      { enabled: false, decidedAt: 99 },
      { crashReportingEnabled: false },
    );
    expect(saved).toBe(true);
    expect(mockGqlFetcher).toHaveBeenCalledWith('UpdateUserDocument', {
      input: {
        preferences: {
          privacy: {
            crashReportingEnabled: false,
            analyticsEnabled: false,
            decidedAt: 99,
            consentVersion: 2,
          },
        },
      },
    });
  });

  it('reports a failed save and resolves false, so callers do not refetch in a loop', async () => {
    mockGqlFetcher.mockRejectedValue(new Error('offline'));
    await expect(saveConsentToAccount({ enabled: true, decidedAt: 1 }, undefined)).resolves.toBe(
      false,
    );
    expect(mockCaptureException).toHaveBeenCalledTimes(1);
  });
});
