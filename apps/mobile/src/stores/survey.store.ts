import { createMMKV, type MMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { isAnalyticsEnabled } from '../lib/analytics';

// ── Types ──

export const SURVEY_TRIGGER_ACTIONS = [
  'expense_added',
  'maintenance_task_created',
  'trip_created',
  'diagnostic_completed',
] as const;

export type SurveyTriggerAction = (typeof SURVEY_TRIGGER_ACTIONS)[number];

// Known PostHog survey ID — update if the survey is recreated
export const SURVEY_ID = '019dd4c5-37cf-0000-8e5d-344982454bee';

// ── MMKV ──

const COOLDOWN_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

let _storage: MMKV | null = null;
function getStorage(): MMKV {
  if (!_storage) _storage = createMMKV({ id: 'survey' });
  return _storage;
}

function lastShownKey(action: SurveyTriggerAction) {
  return `survey:lastShown:${action}`;
}

// ── Store ──

interface SurveyState {
  visible: boolean;
  triggerAction: SurveyTriggerAction | null;
  shownThisSession: boolean;

  /** Atomic check-and-show: prevents double-show race condition. */
  tryShow: (actionType: SurveyTriggerAction) => boolean;
  /** Hides the overlay and clears trigger. */
  dismiss: () => void;
}

export const useSurveyStore = create<SurveyState>((set, get) => ({
  visible: false,
  triggerAction: null,
  shownThisSession: false,

  tryShow: (actionType) => {
    const state = get();
    if (state.shownThisSession) return false;
    if (!isAnalyticsEnabled()) return false;

    const storage = getStorage();
    const lastShown = storage.getNumber(lastShownKey(actionType)) ?? 0;
    // Clock manipulation guard: if timestamp is in the future, bail
    if (lastShown > Date.now()) return false;
    if (Date.now() - lastShown < COOLDOWN_MS) return false;

    // Atomically mark as shown — prevents double-show even with async delay
    set({ shownThisSession: true, triggerAction: actionType });
    storage.set(lastShownKey(actionType), Date.now());

    // Delay visual appearance to avoid colliding with navigation animations
    // (~400ms matches Expo Router's default push/pop transition duration)
    setTimeout(() => {
      if (!get().visible) {
        set({ visible: true });
      }
    }, 400);

    return true;
  },

  dismiss: () => {
    set({ visible: false, triggerAction: null });
  },
}));
