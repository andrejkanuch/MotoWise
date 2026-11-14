import type {
  AnnualRepairSpend,
  Currency,
  ExperienceLevel,
  LastServiceDate,
  MaintenanceStyle,
  MileageUnit,
  MotorcycleType,
  MotorcycleVariant,
  ReminderChannel,
  RidingFrequency,
  RidingGoal,
} from '@motovault/types';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { isFurtherInFlow, type ObVariant, type OnboardingRoute } from '../config/onboarding';
import { captureException } from '../lib/analytics';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';
import { clearEmailDraft } from '../lib/onboarding-email-draft';
import type { PendingIntent } from '../lib/pending-intent';

interface BikeData {
  year: number;
  make: string;
  makeId: number;
  model: string;
  nickname?: string;
  type: MotorcycleType;
  currentMileage: number;
  mileageUnit: MileageUnit;
  photoUri?: string;
  /**
   * Drivetrain/trim variant (U7). Threaded into the OEM-schedule preview so a
   * DCT bike surfaces the verified per-variant intervals; undefined matches the
   * make+model baseline rows. Persisted into the bike on signup (TODO: needs a
   * `variant` field on CreateMotorcycleInput — see U7 summary).
   */
  variant?: MotorcycleVariant;
}

/**
 * issue 365 T13a: which part of the account step was open, so a relaunch returns
 * to it. The address itself lives in SecureStore (`lib/onboarding-email-draft`),
 * never here; the password and the code are never persisted anywhere.
 */
export const ACCOUNT_DRAFT_MODE = {
  /** The email + password form. */
  EMAIL: 'email',
  /** The emailed-code step. */
  CODE: 'code',
} as const;
export type AccountDraftMode = (typeof ACCOUNT_DRAFT_MODE)[keyof typeof ACCOUNT_DRAFT_MODE];

export interface AccountDraft {
  mode: AccountDraftMode;
}

/**
 * issue 365 T13b: the bike-setup search in progress, so a relaunch keeps the
 * picked make, the typed model and the year. Defined with the v10 migration
 * (T13a) so one migration covers both drafts; T13b writes it.
 */
export interface BikeDraft {
  makeId: number | null;
  make: string | null;
  modelQuery: string;
  year: number | null;
}

interface OnboardingState {
  experienceLevel: ExperienceLevel | null;
  bikeData: BikeData | null;
  ridingGoals: RidingGoal[];
  ridingFrequency: RidingFrequency | null;
  /**
   * Variant B "stay on top of" multi-select (concern ids). Drives the Reveal's
   * emphasis bias and paywall value-prop ordering. Client-side only (no server
   * field yet — informs day-0 personalization, not stored preferences).
   */
  stayOnTopOf: string[];
  /** Pre-bike mileage captured in B's "last service" step (km/mi by unit). */
  preBikeMileage: number | null;
  preBikeMileageUnit: MileageUnit | null;
  maintenanceStyle: MaintenanceStyle | null;
  annualRepairSpend: AnnualRepairSpend | null;
  maintenanceReminders: boolean;
  reminderChannel: ReminderChannel | null;
  seasonalTips: boolean;
  recallAlerts: boolean;
  weeklySummary: boolean;
  lastServiceDate: LastServiceDate | null;
  currency: Currency | null;
  /** OEM schedule IDs the user accepted in the maintenance swipe screen */
  acceptedOemScheduleIds: string[];
  /** V2: tracks last completed screen for resume-after-kill */
  lastCompletedScreen: OnboardingRoute | null;
  /**
   * issue 365 T04b: the step last on screen and when (epoch ms), written on every
   * step focus, plus whether an email code step was open on it. Read by the
   * `onboarding_resumed` event only. New optional fields: an older (v9) state
   * loads unchanged and takes the defaults below, so no version bump; v10 is T13a's.
   */
  lastViewedScreen: OnboardingRoute | null;
  lastViewedAt: number | null;
  codeStepPending: boolean;
  /** issue 365 T13a (persist v10): the account step's open part. Never an email or password. */
  accountDraft: AccountDraft | null;
  setAccountDraft: (draft: AccountDraft | null) => void;
  /** issue 365 T13b (persist v10 field): the bike-setup search, restored on mount. */
  bikeDraft: BikeDraft | null;
  /**
   * issue 365 T13b (persist v10 field): the furthest step the rider reached, by
   * flow index, raised on every step focus and never lowered by a back-walk. The
   * resume target (`getResumeTarget`); `lastViewedScreen` stays for analytics.
   */
  furthestScreen: OnboardingRoute | null;
  /** Raises `furthestScreen` to `screen` when it is further into `variant`'s flow; never lowers it. */
  raiseFurthestScreen: (screen: OnboardingRoute, variant: ObVariant) => void;
  /** issue 365 T13b: the bike-setup search on screen; null once the step is done. */
  setBikeDraft: (draft: BikeDraft | null) => void;
  setLastViewedScreen: (screen: OnboardingRoute, at: number) => void;
  /** No-op outside an onboarding run (no step viewed yet), e.g. the (auth) login code step. */
  setCodeStepPending: (pending: boolean) => void;
  /**
   * issue 365 T04b: the root gate opened (tabs), so no onboarding run is in
   * progress. Drops the resume point and the last viewed step; a rider who signed
   * in from onboarding's sign-in step never reaches personalizing's reset().
   * No-op when nothing is on record.
   */
  clearResumePoint: () => void;
  /**
   * Self-reported acquisition channel from the post-paywall "How did you hear
   * about us?" step (attribution). Persisted so it survives a resume-after-kill;
   * mirrored to PostHog ($set_once) + RevenueCat (custom attr) at selection time.
   */
  heardFrom: string | null;
  /**
   * Web→app "which bike" intent resolved on first launch from the Android Play
   * install referrer (iOS has no transport — see pending-intent-reader). Holds
   * the raw make/model; bike-setup resolves the make against its loaded list to
   * render the one-tap "Is this your ride?" confirmation, and paywall
   * personalization reads it for the maintenance-intent cohort. Cleared on
   * reset() so it never leaks into a later onboarding run. Fail-open: absence
   * means the normal, untouched onboarding flow.
   */
  pendingIntent: PendingIntent | null;
  /**
   * True once first-launch intent resolution has settled (referrer read done, or
   * the kill-switch is off). NON-persisted — re-derived each process at cold
   * start by the reader. The paywall waits on this so a late-arriving intent
   * can't miss the maintenance placement behind the one-shot present latch.
   */
  intentResolved: boolean;
  /**
   * `garage_first` only: true from the moment personalizing starts saving the
   * rider's setup until they tap "Open my garage" and the paywall resolves.
   * Saving marks onboarding complete on the server, and the root gate would
   * otherwise switch to (tabs) as soon as the `me` refetch lands — before the
   * payoff CTA and its paywall. Persisted so a kill mid-paywall still resumes
   * into personalizing, whose resume path resets the store (clearing it).
   */
  awaitingGarageCta: boolean;
  setAwaitingGarageCta: (awaiting: boolean) => void;
  /**
   * True once personalizing's `completeOnboarding` resolved for this onboarding
   * run. Persisted so a kill on the payoff screen does not re-run the completion
   * on resume (a second photo upload, `onboarding_completed` and Meta
   * CompleteRegistration). Cleared by reset() when the rider enters the garage.
   */
  completionSent: boolean;
  setCompletionSent: (sent: boolean) => void;
  /**
   * The notifications step's unchecked "the developer may contact me" line.
   * Sent with `completeOnboarding` (only when true), which saves it to the
   * account as `preferences.feedbackContact`.
   */
  feedbackContactOptIn: boolean;
  setFeedbackContactOptIn: (optIn: boolean) => void;
  /**
   * Sign-out: drops the whole onboarding run — answers, resume point and the
   * completion flags. Onboarding progress belongs to the account that made it:
   * keeping the answers let the next account on the device "resume" at the last
   * screen with the previous rider's goals and bike, auto-complete onboarding in
   * a second and skip the onboarding paywall. Same as reset(); named for the call
   * site so the account-boundary rule stays visible.
   */
  resetForSignOut: () => void;
  setIntentResolved: (resolved: boolean) => void;
  setAcceptedOemScheduleIds: (ids: string[]) => void;
  setExperienceLevel: (level: ExperienceLevel) => void;
  setBikeData: (data: BikeData | null) => void;
  setRidingGoals: (goals: RidingGoal[]) => void;
  setRidingFrequency: (frequency: RidingFrequency) => void;
  setStayOnTopOf: (ids: string[]) => void;
  setPreBikeMileage: (mileage: number | null, unit: MileageUnit | null) => void;
  setMaintenanceStyle: (style: MaintenanceStyle) => void;
  setAnnualRepairSpend: (spend: AnnualRepairSpend) => void;
  setMaintenanceReminders: (enabled: boolean) => void;
  setReminderChannel: (channel: ReminderChannel) => void;
  setSeasonalTips: (enabled: boolean) => void;
  setRecallAlerts: (enabled: boolean) => void;
  setWeeklySummary: (enabled: boolean) => void;
  setLastServiceDate: (date: LastServiceDate) => void;
  setCurrency: (currency: Currency) => void;
  setLastCompletedScreen: (screen: OnboardingRoute) => void;
  setHeardFrom: (source: string) => void;
  setPendingIntent: (intent: PendingIntent | null) => void;
  reset: () => void;
}

const initialState = {
  experienceLevel: null as ExperienceLevel | null,
  bikeData: null as BikeData | null,
  ridingGoals: [] as RidingGoal[],
  ridingFrequency: null as RidingFrequency | null,
  stayOnTopOf: [] as string[],
  preBikeMileage: null as number | null,
  preBikeMileageUnit: null as MileageUnit | null,
  maintenanceStyle: null as MaintenanceStyle | null,
  annualRepairSpend: null as AnnualRepairSpend | null,
  maintenanceReminders: true,
  reminderChannel: null as ReminderChannel | null,
  seasonalTips: true,
  recallAlerts: true,
  weeklySummary: false,
  lastServiceDate: null as LastServiceDate | null,
  currency: null as Currency | null,
  acceptedOemScheduleIds: [] as string[],
  lastCompletedScreen: null as OnboardingRoute | null,
  lastViewedScreen: null as OnboardingRoute | null,
  lastViewedAt: null as number | null,
  codeStepPending: false,
  accountDraft: null as AccountDraft | null,
  bikeDraft: null as BikeDraft | null,
  furthestScreen: null as OnboardingRoute | null,
  heardFrom: null as string | null,
  pendingIntent: null as PendingIntent | null,
  intentResolved: false,
  awaitingGarageCta: false,
  completionSent: false,
  feedbackContactOptIn: false,
};

export const useOnboardingStore = create<OnboardingState>()(
  persist(
    (set, get, store) => ({
      ...initialState,
      setExperienceLevel: (level) => set({ experienceLevel: level }),
      setBikeData: (data) => set({ bikeData: data }),
      setRidingGoals: (goals) => set({ ridingGoals: goals }),
      setRidingFrequency: (frequency) => set({ ridingFrequency: frequency }),
      setStayOnTopOf: (ids) => set({ stayOnTopOf: ids }),
      setPreBikeMileage: (preBikeMileage, preBikeMileageUnit) =>
        set({ preBikeMileage, preBikeMileageUnit }),
      setMaintenanceStyle: (style) => set({ maintenanceStyle: style }),
      setAnnualRepairSpend: (spend) => set({ annualRepairSpend: spend }),
      setAcceptedOemScheduleIds: (ids) => set({ acceptedOemScheduleIds: ids }),
      setMaintenanceReminders: (enabled) => set({ maintenanceReminders: enabled }),
      setReminderChannel: (channel) => set({ reminderChannel: channel }),
      setSeasonalTips: (enabled) => set({ seasonalTips: enabled }),
      setRecallAlerts: (enabled) => set({ recallAlerts: enabled }),
      setWeeklySummary: (enabled) => set({ weeklySummary: enabled }),
      setLastServiceDate: (date) => set({ lastServiceDate: date }),
      setCurrency: (currency) => set({ currency }),
      setLastCompletedScreen: (screen) => set({ lastCompletedScreen: screen }),
      // A new step on screen ends any code step the previous one had open.
      setLastViewedScreen: (lastViewedScreen, lastViewedAt) =>
        set({ lastViewedScreen, lastViewedAt, codeStepPending: false }),
      raiseFurthestScreen: (screen, variant) => {
        if (isFurtherInFlow(variant, screen, get().furthestScreen)) set({ furthestScreen: screen });
      },
      setBikeDraft: (bikeDraft) => set({ bikeDraft }),
      setCodeStepPending: (codeStepPending) => {
        if (get().lastViewedScreen === null || get().codeStepPending === codeStepPending) return;
        set({ codeStepPending });
      },
      clearResumePoint: () => {
        const {
          lastCompletedScreen,
          lastViewedScreen,
          lastViewedAt,
          codeStepPending,
          furthestScreen,
          bikeDraft,
        } = get();
        if (
          !lastCompletedScreen &&
          !lastViewedScreen &&
          lastViewedAt === null &&
          !codeStepPending &&
          !furthestScreen &&
          !bikeDraft
        )
          return;
        set({
          lastCompletedScreen: null,
          lastViewedScreen: null,
          lastViewedAt: null,
          codeStepPending: false,
          furthestScreen: null,
          bikeDraft: null,
        });
      },
      setAccountDraft: (accountDraft) => {
        const current = get().accountDraft;
        if (current?.mode === accountDraft?.mode) return;
        set({ accountDraft });
      },
      setHeardFrom: (heardFrom) => set({ heardFrom }),
      setPendingIntent: (pendingIntent) => set({ pendingIntent }),
      setIntentResolved: (intentResolved) => set({ intentResolved }),
      setAwaitingGarageCta: (awaitingGarageCta) => set({ awaitingGarageCta }),
      setCompletionSent: (completionSent) => {
        set({ completionSent });
        // Onboarding is complete: the email is no longer kept (issue 365 T13a, D10).
        if (completionSent) void clearEmailDraft();
      },
      setFeedbackContactOptIn: (feedbackContactOptIn) => set({ feedbackContactOptIn }),
      // intentResolved is per-process (first-launch intent resolution already
      // settled for this run of the app), not part of an account's onboarding;
      // resetting it would make the next account's paywall wait for a
      // resolution that never re-runs.
      // Both also drop the SecureStore email draft (issue 365 T13a, D10): the
      // address is kept only while this onboarding run is in progress.
      resetForSignOut: () => {
        set({ ...store.getInitialState(), intentResolved: get().intentResolved }, true);
        void clearEmailDraft();
      },
      reset: () => {
        set(store.getInitialState(), true);
        void clearEmailDraft();
      },
    }),
    {
      name: 'onboarding-state',
      version: 10,
      storage: createJSONStorage(() => createZustandMMKVStorage('onboarding-store')),
      partialize: ({
        setExperienceLevel,
        setBikeData,
        setRidingGoals,
        setRidingFrequency,
        setStayOnTopOf,
        setPreBikeMileage,
        setMaintenanceStyle,
        setAnnualRepairSpend,
        setAcceptedOemScheduleIds,
        setMaintenanceReminders,
        setReminderChannel,
        setSeasonalTips,
        setRecallAlerts,
        setWeeklySummary,
        setLastServiceDate,
        setCurrency,
        setLastCompletedScreen,
        setLastViewedScreen,
        setCodeStepPending,
        raiseFurthestScreen,
        setBikeDraft,
        clearResumePoint,
        setAccountDraft,
        setHeardFrom,
        setPendingIntent,
        setIntentResolved,
        setAwaitingGarageCta,
        setCompletionSent,
        setFeedbackContactOptIn,
        resetForSignOut,
        // intentResolved is a per-process resolution flag — never persist it, or a
        // stale `true` would let a later launch skip waiting for the fresh read.
        intentResolved,
        reset,
        ...data
      }) => data,
      migrate: (persistedState: unknown, version: number) => {
        if (!persistedState || typeof persistedState !== 'object')
          return initialState as unknown as OnboardingState;

        const state = persistedState as Record<string, unknown>;

        // V4: Onboarding redesign — add lastCompletedScreen, handle v1→v2 reset
        if (version < 4) {
          // If store has no ridingGoals or is pre-v3, hard reset to clean v2 flow.
          // This catches users mid-v1-onboarding who would have broken state.
          // Note: onboardingCompleted lives in auth store, not here — don't check it.
          const goals = state.ridingGoals as string[] | undefined;
          if (!goals?.length || version < 3) {
            return initialState as unknown as OnboardingState;
          }
          // Otherwise append missing v4 fields
          state.lastCompletedScreen = null;
        }

        // V6: A/B 2026 — Variant B profiling fields.
        if (version < 6) {
          state.stayOnTopOf = state.stayOnTopOf ?? [];
          state.preBikeMileage = state.preBikeMileage ?? null;
          state.preBikeMileageUnit = state.preBikeMileageUnit ?? null;
        }

        // V7: attribution — self-reported acquisition channel.
        if (version < 7) {
          state.heardFrom = state.heardFrom ?? null;
        }

        // V8: web→app intent — resolved "which bike" from install referrer/clipboard.
        if (version < 8) {
          state.pendingIntent = state.pendingIntent ?? null;
        }

        // V9: contact opt-in line on the notifications step (unchecked by default).
        if (version < 9) {
          state.feedbackContactOptIn = state.feedbackContactOptIn ?? false;
        }

        // V10 (issue 365 T13a): the account and bike drafts and the resume target.
        // No email, code or password: the address is in SecureStore.
        if (version < 10) {
          state.accountDraft = state.accountDraft ?? null;
          state.bikeDraft = state.bikeDraft ?? null;
          state.furthestScreen = state.furthestScreen ?? null;
        }

        if (version < 3) {
          state.currency = state.currency ?? null;
        }
        if (version < 2) {
          state.annualRepairSpend = state.annualRepairSpend ?? null;
          state.maintenanceReminders = state.maintenanceReminders ?? true;
          state.reminderChannel = state.reminderChannel ?? null;
          state.seasonalTips = state.seasonalTips ?? true;
          state.recallAlerts = state.recallAlerts ?? true;
          state.weeklySummary = state.weeklySummary ?? false;
          state.lastServiceDate = state.lastServiceDate ?? null;
        }
        return state as unknown as OnboardingState;
      },
      onRehydrateStorage: () => {
        return (_state, error) => {
          if (error) {
            captureException(error, { source: 'onboarding.store.onRehydrateStorage' });
          }
        };
      },
    },
  ),
);
