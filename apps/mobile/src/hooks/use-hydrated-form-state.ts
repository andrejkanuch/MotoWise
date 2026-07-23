import { useCallback, useEffect, useRef, useState } from 'react';

export type HydratedFormState = {
  /** True after `apply` has run once for a truthy source. */
  isHydrated: boolean;
  /** Clear the one-shot guard so the next truthy source can re-seed. */
  reset: () => void;
};

/**
 * One-shot query→form hydration for edit screens.
 *
 * Runs `apply` exactly once when `source` first becomes non-nullish. Later
 * source updates (refetch, new object identity from `.find()`) are ignored so
 * typing / clearing selections cannot re-seed the form mid-edit.
 *
 * Prefer this over a local `initialized`/`hydrated` useState + useEffect pair.
 * Dependent one-shot work (e.g. NHTSA make/model auto-match) should gate on
 * `isHydrated` and keep its own refs — do not fold that into `apply`.
 */
export function useHydratedFormState<T>(
  source: T | null | undefined,
  apply: (data: NonNullable<T>) => void,
): HydratedFormState {
  const [isHydrated, setIsHydrated] = useState(false);
  const hydratedRef = useRef(false);
  const applyRef = useRef(apply);
  applyRef.current = apply;
  // Latest source, readable from reset() without adding it to the effect deps.
  const sourceRef = useRef(source);
  sourceRef.current = source;

  useEffect(() => {
    if (source == null || hydratedRef.current) return;
    hydratedRef.current = true;
    applyRef.current(source as NonNullable<T>);
    setIsHydrated(true);
  }, [source]);

  const reset = useCallback(() => {
    hydratedRef.current = false;
    setIsHydrated(false);
    // Re-seed now if a source is already loaded — a caller that resets while
    // the same source object is still present must re-hydrate immediately
    // rather than wait for a `source` identity change that may never arrive.
    if (sourceRef.current != null) {
      hydratedRef.current = true;
      applyRef.current(sourceRef.current as NonNullable<T>);
      setIsHydrated(true);
    }
  }, []);

  return { isHydrated, reset };
}
