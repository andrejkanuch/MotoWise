import { create } from 'zustand';

interface PendingDeleteState {
  /**
   * Ids of rows whose delete is inside its undo window. Lists filter these out
   * so a row disappears at once on every screen that shows it; the server
   * delete only happens when the window closes (see `useDeferredDelete`).
   * Not persisted: if the app dies inside the window the row is simply kept.
   */
  hiddenIds: Record<string, true>;
  hide: (id: string) => void;
  unhide: (id: string) => void;
}

export const usePendingDeleteStore = create<PendingDeleteState>()((set) => ({
  hiddenIds: {},
  hide: (id) => set((state) => ({ hiddenIds: { ...state.hiddenIds, [id]: true } })),
  unhide: (id) =>
    set((state) => {
      const { [id]: _removed, ...rest } = state.hiddenIds;
      return { hiddenIds: rest };
    }),
}));
