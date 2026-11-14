import { create } from 'zustand';

/**
 * A notice the ride flow leaves for the screen it routes to. The HUD closes as it
 * routes Home, so the notice cannot live on the HUD; the root-mounted toast
 * (`features/ride/ride-not-saved-toast.tsx`) reads it (issue 365 T09).
 */
interface RideNoticeState {
  /** When a ride was ended without saving (epoch ms); `null` once shown. */
  notSavedAt: number | null;
  showNotSaved: () => void;
  clearNotSaved: () => void;
}

export const useRideNoticeStore = create<RideNoticeState>()((set) => ({
  notSavedAt: null,
  showNotSaved: () => set({ notSavedAt: Date.now() }),
  clearNotSaved: () => set({ notSavedAt: null }),
}));
