import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { PROFILE_ROUTE, TAB_ROUTE } from '../config/routes';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

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
export const ALL_CHECKLIST_ITEMS: ChecklistItem[] = [
  {
    id: 'first_ride',
    labelKey: 'checklist.seeFirstRideStats',
    icon: 'MapPin',
    deepLink: PROFILE_ROUTE.RIDES,
    goalRelation: 'track_rides',
  },
  {
    id: 'browse_routes',
    labelKey: 'checklist.findRouteNearYou',
    icon: 'Compass',
    deepLink: TAB_ROUTE.DISCOVER,
    goalRelation: 'discover_routes',
  },
  {
    id: 'first_expense',
    labelKey: 'checklist.trackFirstExpense',
    icon: 'Wallet',
    deepLink: TAB_ROUTE.GARAGE,
    goalRelation: 'manage_expenses',
  },
  {
    id: 'complete_bike',
    labelKey: 'checklist.completeBikeProfile',
    icon: 'Bike',
    deepLink: TAB_ROUTE.GARAGE,
    goalRelation: 'maintain_bike',
  },
  {
    id: 'explore_dashboard',
    labelKey: 'checklist.exploreDashboard',
    icon: 'LayoutDashboard',
    deepLink: TAB_ROUTE.HOME,
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
        // Always rebuild items from source of truth (deep links may have changed)
        const items = buildChecklist(goals);
        if (!get().initialized) {
          set({ items, initialized: true, completedItems: [], dismissed: false });
        } else {
          set({ items });
        }
      },

      completeItem: (id) => {
        const { completedItems } = get();
        if (completedItems.includes(id)) return;
        const updated = [...completedItems, id];
        set({ completedItems: updated });
        trackEvent(AnalyticsEvent.CHECKLIST_ITEM_COMPLETED, {
          item: id,
          items_completed: updated.length,
          items_total: get().items.length,
        });
      },

      dismiss: () => set({ dismissed: true }),

      reset: () => set({ items: [], completedItems: [], dismissed: false, initialized: false }),
    }),
    {
      name: 'checklist-state',
      version: 2,
      storage: createJSONStorage(() => createZustandMMKVStorage('checklist-store')),
      partialize: ({ initialize, completeItem, dismiss, reset, ...data }) => data,
      migrate: (persisted, version) => {
        if (version < 2) {
          // v2: deep links changed — force re-initialization so items rebuild from source
          return { ...(persisted as object), initialized: false, items: [] };
        }
        return persisted as ChecklistState;
      },
    },
  ),
);
