import { createContext, useContext } from 'react';

/**
 * Whether the segment a component renders in can take touches right now: it is
 * the active segment AND the hub screen is focused (nothing pushed or presented
 * over it). Outside a segment it is always true.
 *
 * Components holding a react-native-gesture-handler gesture MUST pass this to
 * `.enabled()`. On iOS Fabric a `display: 'none'` subtree is unmounted natively
 * (`ShadowNodeTraits::Trait::Hidden`) and its UIViews go back to the recycle
 * pool, while the React tree — and so the RNGH handler — stays alive. RNGH only
 * re-binds a handler when its view tag has a mounted view again
 * (`maybeBindHandler` is a no-op for a nil view), so the handler's
 * UIGestureRecognizer stays on the recycled UIView. When a sheet then dequeues
 * that UIView (a keypad key, a quick-add chip) the hidden row's gesture fires
 * from the sheet. `pointerEvents` does not help: the recogniser lives on a view
 * that no longer belongs to the panel. A disabled recogniser receives nothing.
 */
export const SegmentInteractiveContext = createContext(true);

export function useSegmentInteractive(): boolean {
  return useContext(SegmentInteractiveContext);
}
