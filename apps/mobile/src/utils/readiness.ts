/**
 * Thin re-export shim — canonical readiness logic lives in @motovault/types
 * (todo #135). Kept so existing mobile imports don't have to change.
 */
export {
  computeReadiness,
  formatReadinessBrief,
  FUEL_RANGE_SAFETY_FACTOR,
  type ReadinessInput,
  type ReadinessInputBike,
  type ReadinessInputTrip,
  type ReadinessItem,
  type ReadinessReport,
  type ReadinessResult,
  type Severity,
} from '@motovault/types';
