import { create } from 'zustand';

interface TripPlannerState {
  basketIds: string[];
  addToBasket: (id: string) => void;
  removeFromBasket: (id: string) => void;
  toggleBasketItem: (id: string) => void;
  clearBasket: () => void;
  isInBasket: (id: string) => boolean;
}

export const useTripPlannerStore = create<TripPlannerState>((set, get) => ({
  basketIds: [],

  addToBasket: (id) =>
    set((s) => (s.basketIds.includes(id) ? s : { basketIds: [...s.basketIds, id] })),

  removeFromBasket: (id) => set((s) => ({ basketIds: s.basketIds.filter((x) => x !== id) })),

  toggleBasketItem: (id) =>
    set((s) =>
      s.basketIds.includes(id)
        ? { basketIds: s.basketIds.filter((x) => x !== id) }
        : { basketIds: [...s.basketIds, id] },
    ),

  clearBasket: () => set({ basketIds: [] }),

  isInBasket: (id) => get().basketIds.includes(id),
}));
