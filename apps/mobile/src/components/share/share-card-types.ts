import type { MeasurementSystem } from '@motovault/types';

export const CARD_VARIANTS = {
  mapHero: 'mapHero',
  mapSatellite: 'mapSatellite',
  mapHybrid: 'mapHybrid',
  map3D: 'map3D',
  editorialDark: 'editorialDark',
  pbSpotlight: 'pbSpotlight',
  routePrint: 'routePrint',
  elevationStory: 'elevationStory',
} as const;

export type CardVariant = (typeof CARD_VARIANTS)[keyof typeof CARD_VARIANTS];

export type PbCategory = 'topSpeed' | 'longestRide' | 'mostElevation';

/** [longitude, latitude] — GeoJSON order, matching Mapbox convention */
export type LngLat = [longitude: number, latitude: number];

type PbInfo =
  | { isPB: false; pbType: null; prevPbValue: null }
  | { isPB: true; pbType: PbCategory; prevPbValue: number | null };

export type RideSharePayload = {
  rideId: string;
  rideName: string;
  rideNumber: number | null;
  /** ISO 8601 date string */
  date: string;
  distanceM: number;
  durationS: number;
  elevationGainM: number | null;
  elevationPeakM: number | null;
  /** Altitude in meters, sampled at equal distance intervals along the route */
  elevationProfile: number[];
  maxSpeedMps: number | null;
  routeCoordinates: LngLat[];
  mapSnapshotUri: string | null;
  /** Google-encoded polyline (lat/lng) for Mapbox Static Images API */
  routePolyline: string | null;
  bikeName: string | null;
  measurementSystem: MeasurementSystem;
} & PbInfo;

export type ShareDestination =
  | 'instagramStory'
  | 'instagramMessages'
  | 'whatsapp'
  | 'message'
  | 'motovaultDm'
  | 'saveImage'
  | 'copyLink'
  | 'systemShare';

export type ShareResult =
  | { success: true }
  | { success: false; reason: 'unavailable' | 'cancelled' | 'denied' | 'error'; message?: string };

/** Returns the list of card variants available for this ride data */
export function getAvailableVariants(payload: RideSharePayload): CardVariant[] {
  const variants: CardVariant[] = [];
  const hasRoute = payload.routeCoordinates.length >= 2;
  const hasPolyline = !!payload.routePolyline;

  if (payload.mapSnapshotUri && hasRoute) {
    variants.push(CARD_VARIANTS.mapHero);
  }

  // Static map style cards — require encoded polyline for Mapbox Static Images API
  if (hasPolyline) {
    variants.push(CARD_VARIANTS.mapSatellite);
    variants.push(CARD_VARIANTS.mapHybrid);
    variants.push(CARD_VARIANTS.map3D);
  }

  variants.push(CARD_VARIANTS.editorialDark);

  if (payload.isPB) {
    variants.push(CARD_VARIANTS.pbSpotlight);
  }

  if (hasRoute) {
    variants.push(CARD_VARIANTS.routePrint);
  }

  if (payload.elevationProfile.length >= 2 && payload.elevationGainM != null) {
    variants.push(CARD_VARIANTS.elevationStory);
  }

  return variants;
}

/** Returns the index of the card that should be auto-selected */
export function getInitialCardIndex(variants: CardVariant[], payload: RideSharePayload): number {
  if (payload.isPB && payload.pbType === 'topSpeed') {
    const pbIndex = variants.indexOf(CARD_VARIANTS.pbSpotlight);
    if (pbIndex >= 0) return pbIndex;
  }
  return 0;
}
