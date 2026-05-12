import { createMMKV } from 'react-native-mmkv';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';

const mmkv = createMMKV({ id: 'checklist-store' });

const mmkvStorage = {
  getItem: (key: string) => mmkv.getString(key) ?? null,
  setItem: (key: string, value: string) => mmkv.set(key, value),
  removeItem: (key: string) => mmkv.remove(key),
};

export interface ChecklistItem {
  id: string;
  labelKey: string;
  icon: string;
  deepLink: string;
  goalRelation: string;
}

interface ChecklistState {
  items: ChecklistItem[];
  completedItems: string[];
  dismissed: boolean;
  initialized: boolean;
  initialize: (goals: string[]) => void;
  completeItem: (id: string) => void;
  dismiss: () => void;
  reset: () => void;
}

/** All possible checklist items — ordered by goal relevance */
const ALL_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'first_ride',
    labelKey: 'checklist.seeFirstRideStats',
    icon: 'MapPin',
    deepLink: '/(tabs)/(rides)',
    goalRelation: 'track_rides',
  },
  {
    id: 'browse_routes',
    labelKey: 'checklist.findRouteNearYou',
    icon: 'Compass',
    deepLink: '/(tabs)/(discover)',
    goalRelation: 'discover_routes',
  },
  {
    id: 'first_expense',
    labelKey: 'checklist.trackFirstExpense',
    icon: 'Wallet',
    deepLink: '/(tabs)/(garage)',
    goalRelation: 'manage_expenses',
  },
  {
    id: 'complete_bike',
    labelKey: 'checklist.completeBikeProfile',
    icon: 'Bike',
    deepLink: '/(tabs)/(garage)',
    goalRelation: 'maintain_bike',
  },
  {
    id: 'explore_dashboard',
    labelKey: 'checklist.exploreDashboard',
    icon: 'LayoutDashboard',
    deepLink: '/(tabs)/(home)',
    goalRelation: 'just_exploring',
  },
];

/** Build a personalized checklist ordered by the user's goals */
function buildChecklist(goals: string[]): ChecklistItem[] {
  // Put goal-matched items first, then the rest
  const matched: ChecklistItem[] = [];
  const unmatched: ChecklistItem[] = [];

  for (const item of ALL_CHECKLIST_ITEMS) {
    if (goals.includes(item.goalRelation)) {
      matched.push(item);
    } else {
      unmatched.push(item);
    }
  }

  // Always include at most 5 items
  return [...matched, ...unmatched].slice(0, 5);
}

export const useChecklistStore = create<ChecklistState>()(
  persist(
    (set, get) => ({
      items: [],
      completedItems: [],
      dismissed: false,
      initialized: false,

      initialize: (goals) => {
        if (get().initialized) return;
        const items = buildChecklist(goals);
        set({ items, initialized: true, completedItems: [], dismissed: false });
      },

      completeItem: (id) => {
        const { completedItems } = get();
        if (completedItems.includes(id)) return;
        const updated = [...completedItems, id];
        set({ completedItems: updated });
        trackEvent('checklist_item_completed' as never, {
          item: id,
          items_completed: updated.length,
          items_total: get().items.length,
        });
      },

      dismiss: () => set({ dismissed: true }),

      reset: () =>
        set({ items: [], completedItems: [], dismissed: false, initialized: false }),
    }),
    {
      name: 'checklist-state',
      storage: createJSONStorage(() => mmkvStorage),
      partialize: ({ initialize, completeItem, dismiss, reset, ...data }) => data,
    },
  ),
);
