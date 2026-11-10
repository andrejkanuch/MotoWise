/** Features What's New can present, one carousel page each. */
export const WHATS_NEW_FEATURE = {
  ROAD_ATLAS: 'road_atlas',
  RECEIPT_SCAN: 'receipt_scan',
  NOTES_PHOTOS: 'notes_photos',
} as const;

export type WhatsNewFeature = (typeof WHATS_NEW_FEATURE)[keyof typeof WHATS_NEW_FEATURE];

/** Where a page's button takes the rider. Mapped to routes by the hand-off, not here. */
export const WHATS_NEW_DESTINATION = {
  RIDER_INSIGHTS: 'rider_insights',
  SCAN_RECEIPT: 'scan_receipt',
  BIKE_NOTES: 'bike_notes',
} as const;

export type WhatsNewDestination =
  (typeof WHATS_NEW_DESTINATION)[keyof typeof WHATS_NEW_DESTINATION];

/** A page's tag: introduced in the release being shown, or an older feature the rider may have missed. */
export const WHATS_NEW_TAG = {
  NEW: 'new',
  CATCH_UP: 'catch_up',
} as const;

export type WhatsNewTag = (typeof WHATS_NEW_TAG)[keyof typeof WHATS_NEW_TAG];

/** Whether a page's demo shows the rider's own data or a labelled example. */
export const WHATS_NEW_DATA_KIND = {
  YOUR_DATA: 'your_data',
  EXAMPLE: 'example',
} as const;

export type WhatsNewDataKind = (typeof WHATS_NEW_DATA_KIND)[keyof typeof WHATS_NEW_DATA_KIND];

const FEATURE_KEY_ROOT = 'whatsNew.features';

/** i18n keys for one feature's page; the line and button differ per data kind. */
function featureKeys<F extends WhatsNewFeature>(id: F) {
  const stem = `${FEATURE_KEY_ROOT}.${id}` as const;
  return {
    title: `${stem}.title`,
    where: `${stem}.where`,
    yourData: { line: `${stem}.yourData.line`, cta: `${stem}.yourData.cta` },
    example: { line: `${stem}.example.line`, cta: `${stem}.example.cta` },
  } as const;
}

export interface WhatsNewFeatureMeta {
  id: WhatsNewFeature;
  /** The store release that first shipped the feature. */
  introducedIn: string;
  destination: WhatsNewDestination;
  keys: ReturnType<typeof featureKeys>;
}

export const WHATS_NEW_FEATURES = {
  [WHATS_NEW_FEATURE.ROAD_ATLAS]: {
    id: WHATS_NEW_FEATURE.ROAD_ATLAS,
    introducedIn: '3.28.0',
    destination: WHATS_NEW_DESTINATION.RIDER_INSIGHTS,
    keys: featureKeys(WHATS_NEW_FEATURE.ROAD_ATLAS),
  },
  [WHATS_NEW_FEATURE.RECEIPT_SCAN]: {
    id: WHATS_NEW_FEATURE.RECEIPT_SCAN,
    introducedIn: '3.19.1',
    destination: WHATS_NEW_DESTINATION.SCAN_RECEIPT,
    keys: featureKeys(WHATS_NEW_FEATURE.RECEIPT_SCAN),
  },
  [WHATS_NEW_FEATURE.NOTES_PHOTOS]: {
    id: WHATS_NEW_FEATURE.NOTES_PHOTOS,
    introducedIn: '3.22.0',
    destination: WHATS_NEW_DESTINATION.BIKE_NOTES,
    keys: featureKeys(WHATS_NEW_FEATURE.NOTES_PHOTOS),
  },
} as const satisfies Record<WhatsNewFeature, WhatsNewFeatureMeta>;

export interface WhatsNewRelease {
  version: string;
  features: readonly WhatsNewFeature[];
}

/**
 * Store releases with features worth announcing, NEWEST FIRST. Add an entry at
 * the top for each release that introduces one. A build with no entry of its
 * own owes the newest entry at or below it, so patch builds and quiet releases
 * still show a release the rider has not seen.
 */
export const WHATS_NEW_RELEASES = [
  { version: '3.28.0', features: [WHATS_NEW_FEATURE.ROAD_ATLAS] },
  { version: '3.22.0', features: [WHATS_NEW_FEATURE.NOTES_PHOTOS] },
  { version: '3.19.1', features: [WHATS_NEW_FEATURE.RECEIPT_SCAN] },
] as const satisfies readonly WhatsNewRelease[];

/**
 * Older features offered as "You may have missed" pages alongside a newer
 * release, until the rider has been shown or has used them.
 */
export const CATCH_UP_FEATURES: readonly WhatsNewFeature[] = [
  WHATS_NEW_FEATURE.RECEIPT_SCAN,
  WHATS_NEW_FEATURE.NOTES_PHOTOS,
];
