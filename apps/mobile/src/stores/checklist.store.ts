import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';
import { GARAGE_ROUTE, MODAL_ROUTE, PROFILE_ROUTE, TAB_ROUTE } from '../config/routes';
import { AnalyticsEvent, trackEvent } from '../lib/analytics';
import { createZustandMMKVStorage } from '../lib/mmkv-storage';

/** Stable checklist item ids — referenced by the home checklist consumer for routing. */
export const CHECKLIST_ITEM_ID = {
  FIRST_RIDE: 'first_ride',
  BROWSE_ROUTES: 'browse_routes',
  FIRST_EXPENSE: 'first_expense',
  COMPLETE_BIKE: 'complete_bike',
  EXPLORE_DASHBOARD: 'explore_dashboard',
  SCAN_RECEIPT: 'scan_receipt',
} as const;

export interface ChecklistItem {
  id: string;
  labelKey: string;
  icon: string;
  deepLink: string;
  goalRelation: string;
}

export interface ChecklistState {
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
    id: CHECKLIST_ITEM_ID.FIRST_RIDE,
    labelKey: 'checklist.seeFirstRideStats',
    icon: 'MapPin',
    deepLink: PROFILE_ROUTE.RIDES,
    goalRelation: 'track_rides',
  },
  {
    id: CHECKLIST_ITEM_ID.BROWSE_ROUTES,
    labelKey: 'checklist.findRouteNearYou',
    icon: 'Compass',
    deepLink: TAB_ROUTE.DISCOVER,
    goalRelation: 'discover_routes',
  },
  {
    // Routing is resolved dynamically in the consumer (needs a motorcycleId) —
    // this is the no-bike fallback / documentation of the intended destination.
    id: CHECKLIST_ITEM_ID.FIRST_EXPENSE,
    labelKey: 'checklist.trackFirstExpense',
    icon: 'Wallet',
    deepLink: GARAGE_ROUTE.EXPENSE_DASHBOARD,
    goalRelation: 'manage_expenses',
  },
  {
    id: CHECKLIST_ITEM_ID.COMPLETE_BIKE,
    labelKey: 'checklist.completeBikeProfile',
    icon: 'Bike',
    deepLink: TAB_ROUTE.GARAGE,
    goalRelation: 'maintain_bike',
  },
  {
    id: CHECKLIST_ITEM_ID.EXPLORE_DASHBOARD,
    labelKey: 'checklist.exploreDashboard',
    icon: 'LayoutDashboard',
    deepLink: TAB_ROUTE.HOME,
    goalRelation: 'just_exploring',
  },
  {
    // Opens the scan modal (multi-bike picker / single-bike auto-select). Tied to
    // the expenses goal — receipt scanning is the fast path to a logged expense.
    id: CHECKLIST_ITEM_ID.SCAN_RECEIPT,
    labelKey: 'checklist.scanReceipt',
    icon: 'ScanLine',
    deepLink: MODAL_ROUTE.SCAN_RECEIPT,
    goalRelation: 'manage_expenses',
  },
];

/**
 * Persist migration (applied cumulatively, oldest-first — never early-returns so
 * a v2 blob gets both the v3 and v4 passes). Progress (completedItems/dismissed)
 * is always preserved and the card stays visible.
 *  - v3: refresh each persisted item's `deepLink` from source IN PLACE. (The
 *    pre-v3 reset of items:[]+initialized:false lost the card for already-
 *    onboarded users, since `initialize` only runs at onboarding completion.)
 *  - v4: append the "scan a receipt" item for already-onboarded users so the new
 *    activation task shows up without re-running `initialize`.
 * Items with no matching source pass through unchanged. Exported for unit testing.
 */
export function migrateChecklistState(persisted: unknown, version: number): ChecklistState {
  const prev = persisted as ChecklistState;
  let items = prev.items ?? [];
  if (version < 3) {
    items = items.map((item) => {
      const source = ALL_CHECKLIST_ITEMS.find((ci) => ci.id === item.id);
      return source ? { ...item, deepLink: source.deepLink } : item;
    });
  }
  if (version < 4) {
    // Only for an already-initialized checklist (non-empty). Idempotent on id.
    const scanItem = ALL_CHECKLIST_ITEMS.find((ci) => ci.id === CHECKLIST_ITEM_ID.SCAN_RECEIPT);
    if (scanItem && items.length > 0 && !items.some((i) => i.id === scanItem.id)) {
      items = [...items, scanItem];
    }
  }
  return { ...prev, items };
}

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
      version: 4,
      storage: createJSONStorage(() => createZustandMMKVStorage('checklist-store')),
      partialize: ({ initialize, completeItem, dismiss, reset, ...data }) => data,
      migrate: migrateChecklistState,
    },
  ),
);
