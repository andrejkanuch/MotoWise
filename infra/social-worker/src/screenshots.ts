/**
 * Screenshot catalog — maps feature keys to Supabase Storage paths.
 *
 * Screenshots live in `social-media/screenshots/{key}.png` after being uploaded
 * by `scripts/upload-screenshots.ts`. The worker fetches the relevant screenshot
 * at publish time and passes it as a reference image to Gemini so generated
 * images show real app UI instead of hallucinated phone screens.
 *
 * When adding new screenshots:
 *   1. Drop the PNG into `marketing/screenshots/`
 *   2. Add an entry here (key = filename without .png)
 *   3. Run `scripts/upload-screenshots.ts` to sync to Supabase Storage
 */

export interface ScreenshotEntry {
  /** Storage path relative to the `social-media` bucket. */
  storagePath: string;
  /** Short human-readable description for the Gemini drafter. */
  description: string;
  /** Feature area — helps the drafter pick relevant screenshots. */
  feature: string;
}

/**
 * Catalog keyed by screenshot slug. The drafter outputs one or more of these
 * keys in `screenshotKeys` and `scheduled.ts` resolves them to actual images.
 */
export const SCREENSHOT_CATALOG: Record<string, ScreenshotEntry> = {
  'home-dashboard': {
    storagePath: 'screenshots/home-dashboard.png',
    description: 'Home screen — greeting, health ring score 100, mileage 13,500 km, expenses $46',
    feature: 'home',
  },
  'home-alerts-articles': {
    storagePath: 'screenshots/home-alerts-articles.png',
    description: 'Home bottom — maintenance alerts list + recommended articles',
    feature: 'home',
  },
  'home-rides-expenses': {
    storagePath: 'screenshots/home-rides-expenses.png',
    description: 'Home — recent rides and expense summary cards',
    feature: 'home',
  },
  garage: {
    storagePath: 'screenshots/garage.png',
    description: 'Garage — motorcycle list with BMW R 1250 GS, Add a Bike button',
    feature: 'garage',
  },
  'bike-details-hero': {
    storagePath: 'screenshots/bike-details-hero.png',
    description: 'Bike detail — hero photo, health 100%, mileage, maintenance tasks',
    feature: 'garage',
  },
  'flow-add-bike': {
    storagePath: 'screenshots/flow-add-bike.png',
    description: 'Add bike flow — make/model/year selection form',
    feature: 'garage',
  },
  'flow-add-maintenance': {
    storagePath: 'screenshots/flow-add-maintenance.png',
    description: 'Add maintenance task — title, priority, due date fields',
    feature: 'maintenance',
  },
  'flow-add-expense': {
    storagePath: 'screenshots/flow-add-expense.png',
    description: 'Add expense — category, amount, date entry form',
    feature: 'expenses',
  },
  'diagnose-hub': {
    storagePath: 'screenshots/diagnose-hub.png',
    description: 'Diagnose home — start diagnosis CTA, recent diagnostics list',
    feature: 'diagnostics',
  },
  'diagnostic-result': {
    storagePath: 'screenshots/diagnostic-result.png',
    description: 'AI diagnosis result — identified parts, confidence %, severity, fixes',
    feature: 'diagnostics',
  },
  'diagnostic-result-medium': {
    storagePath: 'screenshots/diagnostic-result-medium.png',
    description: 'AI diagnosis result — medium severity variant',
    feature: 'diagnostics',
  },
  'flow-diagnosis-step1-select-bike': {
    storagePath: 'screenshots/flow-diagnosis-step1-select-bike.png',
    description: 'Diagnosis step 1 — select which motorcycle to diagnose',
    feature: 'diagnostics',
  },
  'flow-diagnosis-step2-symptoms': {
    storagePath: 'screenshots/flow-diagnosis-step2-symptoms.png',
    description: 'Diagnosis step 2 — symptom selection (noise, leak, vibration, smoke)',
    feature: 'diagnostics',
  },
  profile: {
    storagePath: 'screenshots/profile.png',
    description: 'Profile screen — user settings, preferences, account info',
    feature: 'profile',
  },
  'trip-discover-feed': {
    storagePath: 'screenshots/trip-discover-feed.png',
    description: 'Route discovery — feed of curated motorcycle routes with photos',
    feature: 'routes',
  },
  'trip-detail-hero': {
    storagePath: 'screenshots/trip-detail-hero.png',
    description: 'Route detail — hero map view with route overlay, stats',
    feature: 'routes',
  },
  'trip-detail-full': {
    storagePath: 'screenshots/trip-detail-full.png',
    description: 'Route detail — full scrolled view with all route info',
    feature: 'routes',
  },
  'trip-detail-itinerary': {
    storagePath: 'screenshots/trip-detail-itinerary.png',
    description: 'Route detail — itinerary stops, waypoints, fuel stops',
    feature: 'routes',
  },
  'trip-planning-new': {
    storagePath: 'screenshots/trip-planning-new.png',
    description: 'New trip planning — destination input, route preferences',
    feature: 'routes',
  },
  'trip-planning-edit': {
    storagePath: 'screenshots/trip-planning-edit.png',
    description: 'Trip planning editor — map with draggable waypoints',
    feature: 'routes',
  },
};

/** Keys suitable for Gemini prompt injection — lists available options. */
export function screenshotCatalogForPrompt(): string {
  return Object.entries(SCREENSHOT_CATALOG)
    .map(([key, entry]) => `  - "${key}" (${entry.feature}): ${entry.description}`)
    .join('\n');
}
