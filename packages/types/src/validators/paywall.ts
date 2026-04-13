import { z } from 'zod';

/**
 * Sources from which the paywall modal can be triggered.
 * Used for analytics attribution.
 */
export const PAYWALL_SOURCE = {
  GPX_EXPORT: 'gpx_export',
  OFFLINE_MAPS: 'offline_maps',
  FUEL_OVERLAY: 'fuel_overlay',
  ROUTE_DETAIL: 'route_detail',
  PROFILE: 'profile',
  SETTINGS: 'settings',
} as const;

export type PaywallSource = (typeof PAYWALL_SOURCE)[keyof typeof PAYWALL_SOURCE];

export const PaywallConfigSchema = z.object({
  /** The pro feature being gated */
  feature: z.string(),
  /** Where the paywall was triggered from (for analytics) */
  source: z.string(),
  /** Headline shown at the top of the paywall */
  title: z.string(),
  /** 3-5 value proposition bullets */
  valuePropBullets: z.array(z.string()).min(3).max(5),
  /** Formatted price string, e.g. "$4.99/mo" */
  price: z.string(),
});

export type PaywallConfig = z.infer<typeof PaywallConfigSchema>;

/**
 * Feature-specific copy map for paywall modals.
 * Keys match common pro-gated features; values provide ready-to-use
 * PaywallConfig objects (minus `source`, which is set at call-site).
 */
export const PAYWALL_COPY = {
  gpx_export: {
    feature: 'gpx_export',
    title: 'Export Routes as GPX',
    valuePropBullets: [
      'Download any route as a GPX file',
      'Open in Garmin, Calimoto, or any GPS app',
      'Share routes with riding buddies',
    ],
  },
  offline_maps: {
    feature: 'offline_maps',
    title: 'Ride Without Signal',
    valuePropBullets: [
      'Download map regions for offline use',
      'Navigate mountain passes with no coverage',
      'Automatic cache of saved routes',
      'Never lose your way in the backcountry',
    ],
  },
  fuel_overlay: {
    feature: 'fuel_overlay',
    title: 'See Fuel Stops on Your Route',
    valuePropBullets: [
      'Gas stations overlaid on every route',
      'Filter by fuel type and brand',
      'Range ring based on your tank size',
      'Never run dry on a long ride',
    ],
  },
} as const;

export type PaywallCopyKey = keyof typeof PAYWALL_COPY;
