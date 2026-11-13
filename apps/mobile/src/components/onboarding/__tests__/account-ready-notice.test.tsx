// issue 365 T11 (FS-OB1a): the transient "Account ready" notice on the onboarding
// step the sign-in screen moved a not-yet-onboarded account to.
jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockParams: { notice?: string } = {};
const mockRouter = { setParams: jest.fn() };
jest.mock('expo-router', () => ({
  useGlobalSearchParams: () => mockParams,
  useRouter: () => mockRouter,
}));

import { act, render, screen } from '@testing-library/react-native';
import { AccessibilityInfo } from 'react-native';
import i18n from '@/i18n';
import { ACCOUNT_READY_NOTICE_MS, AccountReadyNotice } from '../account-ready-notice';

const NOTICE_ID = 'onboarding-account-ready';
let announce: jest.SpyInstance;

beforeEach(() => {
  jest.clearAllMocks();
  jest.useFakeTimers();
  delete mockParams.notice;
  announce = jest.spyOn(AccessibilityInfo, 'announceForAccessibility').mockImplementation(() => {});
});

afterEach(() => {
  announce.mockRestore();
  jest.useRealTimers();
});

describe('AccountReadyNotice', () => {
  it('shows with notice=account_ready, with the English copy', async () => {
    mockParams.notice = 'account_ready';

    await render(<AccountReadyNotice />);

    expect(screen.getByTestId(NOTICE_ID)).toBeTruthy();
    expect(screen.getByText(i18n.t('onboarding.obAccountReadyNotice'))).toBeTruthy();
    expect(i18n.t('onboarding.obAccountReadyNotice')).toBe(
      "Account ready — let's set up your garage",
    );
  });

  it('is gone after 4 s', async () => {
    mockParams.notice = 'account_ready';
    await render(<AccountReadyNotice />);

    await act(async () => {
      jest.advanceTimersByTime(ACCOUNT_READY_NOTICE_MS - 1);
    });
    expect(screen.getByTestId(NOTICE_ID)).toBeTruthy();

    await act(async () => {
      jest.advanceTimersByTime(1);
    });
    expect(screen.queryByTestId(NOTICE_ID)).toBeNull();
    expect(ACCOUNT_READY_NOTICE_MS).toBe(4000);
  });

  it('is announced to screen readers once, however often it re-renders', async () => {
    mockParams.notice = 'account_ready';
    await render(<AccountReadyNotice />);
    await act(async () => {
      screen.rerender(<AccountReadyNotice />);
    });

    expect(announce.mock.calls).toEqual([[i18n.t('onboarding.obAccountReadyNotice')]]);
  });

  it('clears the param once shown, so Back or a re-render does not show it again', async () => {
    mockParams.notice = 'account_ready';
    await render(<AccountReadyNotice />);

    expect(mockRouter.setParams.mock.calls).toEqual([[{ notice: undefined }]]);

    // The param is gone after setParams; the notice runs out and stays gone.
    delete mockParams.notice;
    await act(async () => {
      screen.rerender(<AccountReadyNotice />);
      jest.advanceTimersByTime(ACCOUNT_READY_NOTICE_MS);
    });
    await act(async () => {
      screen.rerender(<AccountReadyNotice />);
    });
    expect(screen.queryByTestId(NOTICE_ID)).toBeNull();
    expect(announce).toHaveBeenCalledTimes(1);
  });

  it('is absent without the param', async () => {
    await render(<AccountReadyNotice />);

    expect(screen.queryByTestId(NOTICE_ID)).toBeNull();
    expect(announce).not.toHaveBeenCalled();
    expect(mockRouter.setParams).not.toHaveBeenCalled();
  });

  it('is absent for another notice value', async () => {
    mockParams.notice = 'something_else';
    await render(<AccountReadyNotice />);

    expect(screen.queryByTestId(NOTICE_ID)).toBeNull();
  });
});
