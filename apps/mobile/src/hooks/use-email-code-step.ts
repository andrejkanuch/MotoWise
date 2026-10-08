import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';

/**
 * An email signup or sign-in waiting for its emailed code. Component state only:
 * the password stays in memory for the already-confirmed recovery and is never
 * persisted. A relaunch reaches the code step again by signing up or in again.
 */
export interface CodeStepState {
  email: string;
  password: string;
  initialCooldownMs?: number;
}

interface UseEmailCodeStepOptions {
  /** Called on close: back on the form the address stays, the password is typed again. */
  clearPassword: () => void;
  /**
   * While true, Android hardware back on the code step is swallowed without
   * closing it (e.g. the screen is already advancing on a new session).
   */
  backLocked?: boolean;
}

export interface EmailCodeStepControls {
  codeStep: CodeStepState | null;
  open: (state: CodeStepState) => void;
  /** Opens the step with the resend wait already running. */
  openRateLimited: (email: string, password: string, retryAfterMs: number) => void;
  /** Back to the form: closes the step and clears the password. */
  close: () => void;
  /**
   * Pass to `EmailCodeStep`'s `onBusyChange`: while a verify or recovery is in
   * flight, Android hardware back is swallowed instead of closing the step.
   */
  onBusyChange: (busy: boolean) => void;
}

/**
 * Shared open/close state for the email code step that replaces an auth form.
 * While a step is open, Android hardware back returns to the form instead of
 * popping the screen — unless the step is busy or `backLocked` is set, when it
 * is swallowed (the in-flight sign-in would land after the form is back).
 */
export function useEmailCodeStep({
  clearPassword,
  backLocked = false,
}: UseEmailCodeStepOptions): EmailCodeStepControls {
  const [codeStep, setCodeStep] = useState<CodeStepState | null>(null);

  const clearPasswordRef = useRef(clearPassword);
  clearPasswordRef.current = clearPassword;
  // Read only by the back handler, so a ref: no re-render on every verify.
  const busyRef = useRef(false);

  const onBusyChange = useCallback((busy: boolean) => {
    busyRef.current = busy;
  }, []);

  const open = useCallback((state: CodeStepState) => {
    busyRef.current = false;
    setCodeStep(state);
  }, []);

  const openRateLimited = useCallback((email: string, password: string, retryAfterMs: number) => {
    busyRef.current = false;
    setCodeStep({ email, password, initialCooldownMs: retryAfterMs });
  }, []);

  const close = useCallback(() => {
    busyRef.current = false;
    setCodeStep(null);
    clearPasswordRef.current();
  }, []);

  const hasCodeStep = codeStep !== null;
  useEffect(() => {
    if (!hasCodeStep) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (!backLocked && !busyRef.current) close();
      return true;
    });
    return () => sub.remove();
  }, [hasCodeStep, backLocked, close]);

  return { codeStep, open, openRateLimited, close, onBusyChange };
}
