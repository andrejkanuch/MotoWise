import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { RESEND_COOLDOWN_MS } from '../config/auth';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import {
  claimEmailDraftRestore,
  clearEmailDraft,
  emailDraftAgeMs,
  isEmailDraftFresh,
  readEmailDraft,
  saveEmailDraft,
} from '../lib/onboarding-email-draft';

const MS_PER_SECOND = 1000;

/**
 * An email signup or sign-in waiting for its emailed code. The password stays in
 * memory for the already-confirmed recovery and is never persisted; a step
 * restored after a relaunch has none (verifying the code does not need it).
 */
export interface CodeStepState {
  email: string;
  password?: string;
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
  /**
   * Onboarding only (issue 365 T13a, FS-OB3): keep `{email, codeSentAt}` in
   * SecureStore while a step is open, and on mount reopen a step whose code went
   * out within the last hour.
   */
  persistDraft?: boolean;
  /**
   * With `persistDraft`: the address of a restored draft. Fresh, the step reopens
   * and the form behind it keeps the address for "Change email"; older than an
   * hour, only the form opens, prefilled.
   */
  onDraftEmail?: (email: string) => void;
  /**
   * With `persistDraft`: the rider has typed into the form. A saved draft read
   * after that never replaces what they typed.
   */
  formDirty?: boolean;
}

export interface EmailCodeStepControls {
  codeStep: CodeStepState | null;
  open: (state: CodeStepState) => void;
  /** Opens the step with the resend wait already running. */
  openRateLimited: (email: string, password: string, retryAfterMs: number) => void;
  /** Back to the form: closes the step and clears the password. */
  close: () => void;
  /**
   * Back from an on-screen button or hardware back: closes the step unless a
   * verify or recovery is in flight or `backLocked` is set.
   */
  back: () => void;
  /**
   * Pass to `EmailCodeStep`'s `onBusyChange`: while a verify or recovery is in
   * flight, Android hardware back is swallowed instead of closing the step.
   */
  onBusyChange: (busy: boolean) => void;
  /** Pass to `EmailCodeStep`'s `onCodeResent`: a resend restarts the saved wait. */
  onCodeResent: () => void;
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
  persistDraft = false,
  onDraftEmail,
  formDirty = false,
}: UseEmailCodeStepOptions): EmailCodeStepControls {
  const [codeStep, setCodeStep] = useState<CodeStepState | null>(null);

  const clearPasswordRef = useRef(clearPassword);
  clearPasswordRef.current = clearPassword;
  const onDraftEmailRef = useRef(onDraftEmail);
  onDraftEmailRef.current = onDraftEmail;
  const formDirtyRef = useRef(formDirty);
  formDirtyRef.current = formDirty;
  // The open step's address, for the resend callback.
  const emailRef = useRef<string | null>(null);
  // Read only by the back handler, so a ref: no re-render on every verify.
  const busyRef = useRef(false);
  // Set by any open or close: the rider acted before the saved draft was read.
  const touchedRef = useRef(false);

  const onBusyChange = useCallback((busy: boolean) => {
    busyRef.current = busy;
  }, []);

  const show = useCallback(
    (state: CodeStepState) => {
      touchedRef.current = true;
      busyRef.current = false;
      emailRef.current = state.email;
      setCodeStep(state);
      if (!persistDraft) return;
      // A step opened in this launch is live: nothing left to restore.
      claimEmailDraftRestore();
      void saveEmailDraft({ email: state.email, codeSentAt: Date.now() });
    },
    [persistDraft],
  );

  const open = useCallback((state: CodeStepState) => show(state), [show]);

  const openRateLimited = useCallback(
    (email: string, password: string, retryAfterMs: number) =>
      show({ email, password, initialCooldownMs: retryAfterMs }),
    [show],
  );

  const close = useCallback(() => {
    touchedRef.current = true;
    busyRef.current = false;
    emailRef.current = null;
    setCodeStep(null);
    clearPasswordRef.current();
    // "Change email": the saved address no longer has a code on its way.
    if (persistDraft) void clearEmailDraft();
  }, [persistDraft]);

  const onCodeResent = useCallback(() => {
    const email = emailRef.current;
    if (persistDraft && email) void saveEmailDraft({ email, codeSentAt: Date.now() });
  }, [persistDraft]);

  // After a relaunch: back on the code step for the saved address (no password).
  // Only the first read of the launch restores (`claimEmailDraftRestore`).
  useEffect(() => {
    if (!persistDraft) return;
    let cancelled = false;
    void readEmailDraft().then((draft) => {
      if (cancelled || !claimEmailDraftRestore()) return;
      if (touchedRef.current || formDirtyRef.current || !draft) return;
      const now = Date.now();
      onDraftEmailRef.current?.(draft.email);
      if (!isEmailDraftFresh(draft, now)) return;
      const ageMs = emailDraftAgeMs(draft, now);
      emailRef.current = draft.email;
      setCodeStep({
        email: draft.email,
        initialCooldownMs: Math.max(0, RESEND_COOLDOWN_MS - ageMs),
      });
      trackEvent(AnalyticsEvent.EMAIL_CODE_STEP_RESTORED, {
        age_s: Math.round(ageMs / MS_PER_SECOND),
      });
    });
    return () => {
      cancelled = true;
    };
  }, [persistDraft]);

  const back = useCallback(() => {
    if (!backLocked && !busyRef.current) close();
  }, [backLocked, close]);

  const hasCodeStep = codeStep !== null;
  useEffect(() => {
    if (!hasCodeStep) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => sub.remove();
  }, [hasCodeStep, back]);

  return { codeStep, open, openRateLimited, close, back, onBusyChange, onCodeResent };
}
