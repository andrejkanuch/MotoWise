import {
  BIKE_LEAF,
  BIKE_ORIGIN,
  BIKE_SEGMENT,
  BIKE_SEGMENT_ORDER,
  type BikeLeaf,
  type BikeOrigin,
  type BikeSegment,
} from './constants';

const SEGMENTS: readonly string[] = BIKE_SEGMENT_ORDER;
const ORIGINS: readonly string[] = Object.values(BIKE_ORIGIN);

export function isBikeSegment(value: unknown): value is BikeSegment {
  return typeof value === 'string' && SEGMENTS.includes(value);
}

export interface InitialSegmentInput {
  /** `segment` route param. */
  segmentParam?: string | null;
  /** `highlightTask` route param — a task to expand on the Service segment. */
  highlightTask?: string | null;
  /** The segment last used on this bike (persisted). */
  remembered?: string | null;
}

/**
 * Landing rule of the bike screen: an explicit `segment` param wins, then a
 * highlighted task opens Service, then the remembered segment, else Overview.
 * Unknown strings (a stale param, a persisted value from another build) fall
 * through to the next rule.
 */
export function resolveInitialSegment(input: InitialSegmentInput): BikeSegment {
  const { segmentParam, highlightTask, remembered } = input;
  if (isBikeSegment(segmentParam)) return segmentParam;
  if (highlightTask) return BIKE_SEGMENT.SERVICE;
  if (isBikeSegment(remembered)) return remembered;
  return BIKE_SEGMENT.OVERVIEW;
}

/** `from` route param → origin. Absent or unknown → the garage list. */
export function parseOrigin(param: string | null | undefined): BikeOrigin {
  const known = ORIGINS.find((origin) => origin === param);
  return (known as BikeOrigin | undefined) ?? BIKE_ORIGIN.GARAGE;
}

/** `null` = the leaf has no owner: stay on the segment it was opened from. */
const LEAF_OWNER: Record<BikeLeaf, BikeSegment | null> = {
  [BIKE_LEAF.ADD_TASK]: BIKE_SEGMENT.SERVICE,
  [BIKE_LEAF.EDIT_TASK]: BIKE_SEGMENT.SERVICE,
  [BIKE_LEAF.COMPLETE_TASK]: BIKE_SEGMENT.SERVICE,
  [BIKE_LEAF.ADD_EXPENSE]: BIKE_SEGMENT.COSTS,
  [BIKE_LEAF.EXPENSE_DETAIL]: BIKE_SEGMENT.COSTS,
  [BIKE_LEAF.DOCUMENT]: BIKE_SEGMENT.BIKE,
  [BIKE_LEAF.ADD_DOCUMENT]: BIKE_SEGMENT.BIKE,
  [BIKE_LEAF.EDIT_BIKE]: BIKE_SEGMENT.BIKE,
  [BIKE_LEAF.SERVICE_REPORT]: BIKE_SEGMENT.BIKE,
  [BIKE_LEAF.RECALLS]: BIKE_SEGMENT.OVERVIEW,
  [BIKE_LEAF.NOTES]: null,
};

/** The segment a rider lands on when coming back from a pushed leaf. */
export function ownerSegmentOf(leaf: BikeLeaf): BikeSegment | null {
  return LEAF_OWNER[leaf];
}
