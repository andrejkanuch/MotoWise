import { type Href, useIsFocused, useRouter } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Two pushes this close together are one double-tap (or a tap landing while
 * the first push is still animating): only the first one navigates.
 */
export const LEAF_PUSH_COOLDOWN_MS = 600;

/**
 * `router.push` for screens that open sheets and leaves from rows and buttons
 * (the bike hub, the Notes screen). A push is dropped when the screen is not
 * focused — read at press time: a row stays mounted (and, mid-transition,
 * tappable) under a screen being pushed, and a sheet pushed from a screen no
 * longer on top stacked over that screen and could not be dismissed — or when
 * it lands within `LEAF_PUSH_COOLDOWN_MS` of the last one. Returns whether it
 * navigated. Stable across renders.
 */
export function useGuardedPush(): (href: Href) => boolean {
  const router = useRouter();
  const isFocused = useIsFocused();
  const focusedRef = useRef(isFocused);
  focusedRef.current = isFocused;
  const lastPushAt = useRef(0);
  return useCallback(
    (href: Href) => {
      const now = Date.now();
      if (!focusedRef.current || now - lastPushAt.current < LEAF_PUSH_COOLDOWN_MS) return false;
      lastPushAt.current = now;
      router.push(href);
      return true;
    },
    [router],
  );
}
