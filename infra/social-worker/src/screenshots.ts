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
  'home-dashboard-hero': {
    storagePath: 'screenshots/01-home-dashboard-hero.png',
    description:
      'Home screen — "Today in your garage" greeting, BMW R 1250 GS hero card with ODO 13.5k km, next service 6 days, 98% ready, overdue alert, quick actions (Diagnose, Add Task, Expenses, Plan)',
    feature: 'home',
  },
  'home-dashboard-tasks-stats': {
    storagePath: 'screenshots/02-home-dashboard-tasks-stats.png',
    description:
      'Home bottom — upcoming tasks (Oil Change Overdue, Tire Pressure Check), monthly mileage goal 0/600 km, last 7 days bar chart, Open analytics link',
    feature: 'home',
  },
  'discover-map-search-drafts': {
    storagePath: 'screenshots/03-discover-map-search-drafts.png',
    description:
      'Discover tab — map with 20 routes nearby, search bar, country chips (Argentina, Austria, Australia), filter chips (Popular, Twisty, Paved, Mixed), bike-specific recommendations, weather badge, draft trip card (Mani Peninsula), Plan trip FAB',
    feature: 'routes',
  },
  'discover-route-list': {
    storagePath: 'screenshots/04-discover-route-list.png',
    description:
      'Discover — all routes list with Route 62 (450 km, Paved, Moderate), Panorama Route (180 km, Easy), Sani Pass (Editor\'s Pick), Plan trip FAB',
    feature: 'routes',
  },
  'trip-detail-map-overview': {
    storagePath: 'screenshots/05-trip-detail-map-overview.png',
    description:
      'Trip detail — map with route overlay (Worcester to Oudtshoorn), waypoint markers (camera, food, overnight, finish), Spirited badge, 2 days / 8 stops stats, full route description',
    feature: 'routes',
  },
  'trip-detail-description-stats': {
    storagePath: 'screenshots/06-trip-detail-description-stats.png',
    description:
      'Trip detail scrolled — Route 62 description, 450 km distance, 2400 m elevation, 2 views, Worcester → Oudtshoorn, reviews section, Write a Review CTA, Sample Itinerary header',
    feature: 'routes',
  },
  'trip-detail-itinerary-gpx': {
    storagePath: 'screenshots/07-trip-detail-itinerary-gpx-export.png',
    description:
      'Trip detail itinerary — Day 2 stops (Ladismith, Calitzdorp, Cango Caves, Oudtshoorn) with time-of-day sections, Add to My Trips button, Save for Later, Export GPX',
    feature: 'routes',
  },
  'ride-hud-recording': {
    storagePath: 'screenshots/08-ride-hud-recording.png',
    description:
      'Ride HUD — RECORDING badge, live map, speedometer (0 KM/H), lean angle gauge (0°), distance/time/avg/max/elev/alt stats grid, pause button, HOLD TO END button',
    feature: 'rides',
  },
  'garage-shelf-view': {
    storagePath: 'screenshots/09-garage-shelf-view.png',
    description:
      'Garage — shelf view with BMW R 1250 GS PRIMARY card (N°01, 2023, ODO 13,504 km, since 2026), By the Numbers section (total km, oldest bike, open tasks)',
    feature: 'garage',
  },
  'bike-detail-header-actions': {
    storagePath: 'screenshots/10-bike-detail-header-actions.png',
    description:
      'Bike detail — hero photo, 2023 BMW R 1250 GS, 13,504 km, 98% ready, Add Task / Add Expense actions, cost/km $0.34, 11 rides, Analytics view link, Service Report card',
    feature: 'garage',
  },
  'bike-detail-service-maintenance': {
    storagePath: 'screenshots/11-bike-detail-service-report-maintenance.png',
    description:
      'Bike detail — Service Report card, Maintenance section with Active (14) / History (12) tabs, overdue task (By men Olen), Tire Pressure Check (LOW), 20,000 km Major Service (HIGH), Done/Delete swipe actions',
    feature: 'maintenance',
  },
  'bike-detail-expenses-breakdown': {
    storagePath: 'screenshots/12-bike-detail-expenses-breakdown.png',
    description:
      'Bike detail expenses — €481.95 total (2026), color-coded category bar (Fuel €182, Gear €34.95, Service €15, Training €250), expense list with dates',
    feature: 'expenses',
  },
  'expense-insights-total-cost': {
    storagePath: 'screenshots/13-expense-insights-total-cost.png',
    description:
      'Expense Insights — BMW R 1250 GS, All Time total €4,622.65, Gear €1,348.05 (29%), Total Cost of Ownership €26,122.65 (bike €21,500 + expenses), avg/mo €420.24, 38 entries, cost/km €0.34',
    feature: 'expenses',
  },
  'expense-insights-by-category': {
    storagePath: 'screenshots/14-expense-insights-by-category.png',
    description:
      'Expense Insights — By category breakdown: Gear 29%, Fuel 15%, Tires 14%, Service 12%, Insurance 9%, Parts 8%, Mods 6%, Training 5%, Registration 2%, Tolls/Parking 0%',
    feature: 'expenses',
  },
  'expense-insights-monthly-trend': {
    storagePath: 'screenshots/15-expense-insights-monthly-trend.png',
    description:
      'Expense Insights — monthly trend stacked bar chart (May–Dec), color-coded by category, showing spending spikes in Aug/Nov',
    feature: 'expenses',
  },
  'add-expense-form': {
    storagePath: 'screenshots/16-add-expense-form.png',
    description:
      'Add Expense form sheet — "Log an expense" header, amount input (€), category chips (Fuel, Service, Parts, Tires, Gear, Insurance), date picker, details field',
    feature: 'expenses',
  },
  'my-rides-activity': {
    storagePath: 'screenshots/17-my-rides-activity.png',
    description:
      'My Rides — 13 rides badge, this week stats (3.8 km, 4 rides, 12m), this month 0 km / all time 806 km, activity feed with ride cards (Quick Ride, Thursday Afternoon Ride)',
    feature: 'rides',
  },
  'my-trips-list': {
    storagePath: 'screenshots/18-my-trips-list.png',
    description:
      'My Trips — draft banner, trip cards (Mani Peninsula DRAFT/Spirited, Turkish Black Sea Technical, Adventure Czech Republic), visibility badges (Link only, Private), participant counts, + create button',
    feature: 'routes',
  },
  'trip-creation-itinerary': {
    storagePath: 'screenshots/19-trip-creation.png',
    description:
      'Trip creation — map with route overlay (Mani Peninsula, Greece), "9 stops planned" subtitle, Trip Title field, search bar, Day 1 itinerary with MORNING section (Gythio start, Areopoli 24.9 km, Diros Sea Caves 7.5 km), reorder/calendar/delete actions',
    feature: 'routes',
  },
  'trip-creation-settings': {
    storagePath: 'screenshots/20-trip-creation-detail.png',
    description:
      'Trip creation settings — Start/End Date pickers (1–2 May 2026), Difficulty chips (Easy/Moderate/Challenging/Expert, Moderate selected), Visibility options (Private/Link only/Public, Link only selected), Max Riders input (5), Draft/Publish explanation, Cancel/Save Draft/Publish buttons',
    feature: 'routes',
  },
  'trip-creation-details': {
    storagePath: 'screenshots/21-trip-creation-detail.png',
    description:
      'Trip creation scrolled — EVENING section (Stoupa Beach 71.8 km, Kalamata end 57.3 km), Day 2 empty with "Add Day" dashed button, expanded details section with description text about Mani Peninsula, Start/End Date, Difficulty chips, Visibility settings',
    feature: 'routes',
  },
  'ai-diagnosis-home': {
    storagePath: 'screenshots/22-ai-diagnosis.png',
    description:
      'Diagnose tab — "AI-powered photo diagnostics for your bike" subtitle, blue gradient "Start New Diagnosis" card with camera icon and Pro badge, Recent Diagnostics list (3 entries for BMW R 1250 GS: high 3/23, medium 3/20, high 3/20), bottom tab bar',
    feature: 'diagnostics',
  },
};

/** Keys suitable for Gemini prompt injection — lists available options. */
export function screenshotCatalogForPrompt(): string {
  return Object.entries(SCREENSHOT_CATALOG)
    .map(([key, entry]) => `  - "${key}" (${entry.feature}): ${entry.description}`)
    .join('\n');
}
