import type { QueryMeta } from '@tanstack/react-query';
import { QUERY_CRITICALITY } from './query-criticality';

/**
 * Query `meta` presets. Every observer of a shared key must pass one of them
 * for the opt-out to take effect — the global handler decides over all
 * observers (`resolveFailureHandling` in `query-client.ts`).
 */
export const QUERY_META = {
  /** The consumer renders its own inline error (with Retry) for a failed first load. */
  OWN_ERROR_UI: { showErrorAlert: false },
  /**
   * A decorative read whose consumer renders nothing when the data is absent.
   * Must meet the ENHANCEMENT entry criteria in `query-criticality.ts`.
   */
  DECORATION: { criticality: QUERY_CRITICALITY.ENHANCEMENT },
} as const satisfies Record<string, QueryMeta>;
