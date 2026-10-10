jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  notificationAsync: jest.fn(),
  ImpactFeedbackStyle: { Light: 'light', Medium: 'medium' },
  NotificationFeedbackType: { Success: 'success', Warning: 'warning', Error: 'error' },
}));
jest.mock('react-native-safe-area-context', () => ({
  useSafeAreaInsets: () => ({ top: 0, bottom: 0, left: 0, right: 0 }),
}));

const mockStep = { variant: 'garage_first', stepIndex: 2, totalScreens: 8 };
jest.mock('@/hooks/use-onboarding-flow', () => ({
  useOnboardingStep: () => mockStep,
}));

import { fireEvent, render, screen } from '@testing-library/react-native';
import { useKeyboardState } from 'react-native-keyboard-controller';
import { OB_SCREEN } from '@/config/onboarding';
import i18n from '@/i18n';
import { FOOTER_MAX_FONT_SCALE } from '../onboarding-continue-button';
import { OnboardingShell } from '../onboarding-shell';

const t = (key: string, options?: Record<string, unknown>) => i18n.t(key, options);

const PRIMARY = 'Continue';
const SECONDARY = 'Maybe later';

type KeyboardState = { isVisible: boolean; height: number };
const mockKeyboard = useKeyboardState as unknown as jest.Mock;

function setKeyboardVisible(isVisible: boolean) {
  const state: KeyboardState = { isVisible, height: isVisible ? 300 : 0 };
  mockKeyboard.mockImplementation((selector?: (s: KeyboardState) => unknown) =>
    selector ? selector(state) : state,
  );
}

function renderShell(overrides: Partial<React.ComponentProps<typeof OnboardingShell>> = {}) {
  return render(
    <OnboardingShell
      screen={OB_SCREEN.GOALS}
      title="What do you want to track?"
      primary={{ label: PRIMARY, onPress: jest.fn() }}
      secondary={{ label: SECONDARY, onPress: jest.fn() }}
      {...overrides}
    />,
  );
}

beforeEach(() => {
  mockStep.stepIndex = 2;
  mockStep.totalScreens = 8;
  setKeyboardVisible(false);
});

describe('OnboardingShell — progress', () => {
  it('reports the rider’s step out of the visible total', async () => {
    await renderShell();
    const bar = screen.getByRole('progressbar');
    expect(bar.props.accessibilityValue).toEqual({ min: 0, max: 8, now: 3 });
    expect(bar.props.accessibilityLabel).toBe(t('onboarding.progressA11y', { step: 3, total: 8 }));
  });

  it('follows the step it is given', async () => {
    mockStep.stepIndex = 0;
    mockStep.totalScreens = 5;
    await renderShell();
    expect(screen.getByRole('progressbar').props.accessibilityValue).toEqual({
      min: 0,
      max: 5,
      now: 1,
    });
  });

  it('shows no track for a screen outside the flow', async () => {
    mockStep.stepIndex = -1;
    await renderShell();
    expect(screen.queryByRole('progressbar')).toBeNull();
  });

  it('shows no track when no screen is given', async () => {
    await renderShell({ screen: undefined });
    expect(screen.queryByRole('progressbar')).toBeNull();
  });
});

describe('OnboardingShell — back', () => {
  it('calls onBack from the back control', async () => {
    const onBack = jest.fn();
    await renderShell({ onBack });
    fireEvent.press(screen.getByLabelText(t('common.back')));
    expect(onBack).toHaveBeenCalledTimes(1);
  });

  it('hides the back control on non-reversible steps (no onBack)', async () => {
    await renderShell({ onBack: undefined });
    expect(screen.queryByLabelText(t('common.back'))).toBeNull();
  });
});

describe('OnboardingShell — primary', () => {
  it('calls onPress when enabled', async () => {
    const onPress = jest.fn();
    await renderShell({ primary: { label: PRIMARY, onPress } });
    fireEvent.press(screen.getByText(PRIMARY));
    expect(onPress).toHaveBeenCalledTimes(1);
  });

  it('is disabled and does not fire when disabled', async () => {
    const onPress = jest.fn();
    await renderShell({ primary: { label: PRIMARY, onPress, disabled: true } });
    const button = screen.getByRole('button', { name: PRIMARY });
    expect(button.props.accessibilityState).toEqual(expect.objectContaining({ disabled: true }));
    fireEvent.press(screen.getByText(PRIMARY));
    expect(onPress).not.toHaveBeenCalled();
  });
});

describe('OnboardingShell — keyboard', () => {
  it('shows the secondary action while the keyboard is hidden', async () => {
    await renderShell();
    expect(screen.getByText(SECONDARY)).toBeTruthy();
    expect(screen.getByText(PRIMARY)).toBeTruthy();
  });

  it('collapses the secondary action but keeps the primary while the keyboard is up', async () => {
    setKeyboardVisible(true);
    await renderShell();
    expect(screen.queryByText(SECONDARY)).toBeNull();
    expect(screen.getByText(PRIMARY)).toBeTruthy();
  });
});

describe('OnboardingShell — large text', () => {
  it('caps Dynamic Type growth on both footer labels', async () => {
    await renderShell();
    expect(screen.getByText(PRIMARY).props.maxFontSizeMultiplier).toBe(FOOTER_MAX_FONT_SCALE);
    expect(screen.getByText(SECONDARY).props.maxFontSizeMultiplier).toBe(FOOTER_MAX_FONT_SCALE);
  });

  it('leaves the title free to scale', async () => {
    await renderShell();
    expect(
      screen.getByText('What do you want to track?').props.maxFontSizeMultiplier,
    ).toBeUndefined();
  });
});
