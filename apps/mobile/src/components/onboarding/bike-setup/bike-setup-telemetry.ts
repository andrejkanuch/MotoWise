import { createMMKV } from 'react-native-mmkv';

// -------------------------------------------------------------------
// bike_setup_summary (issue 365 T04c, FS-OB4)
// -------------------------------------------------------------------
// One event per visit to the onboarding bike-setup step: how long the rider
// stayed, how many searches they started, how the make and model were picked
// and how long the model list took to load. Counts and enums only — the typed
// search text never leaves the device.
//
// A visit ("session") starts when the screen gains focus and ends exactly
// once: Continue / a quick-make chip (completed), Skip (skipped), Back
// (button, hardware or gesture), or `left` — the screen went away another way,
// the app sat in the background for more than BACKGROUND_LEFT_MS, or the
// process died while the rider was here (reported on the next mount).
// -------------------------------------------------------------------

export const BIKE_SETUP_OUTCOME = {
  COMPLETED: 'completed',
  SKIPPED: 'skipped',
  BACK: 'back',
  LEFT: 'left',
} as const;
export type BikeSetupOutcome = (typeof BIKE_SETUP_OUTCOME)[keyof typeof BIKE_SETUP_OUTCOME];

/** How the make or model now on screen got there. */
export const BIKE_PICKED_VIA = {
  /** A row of the default list (popular makes / first models), no query typed. */
  LIST: 'list',
  /** A row of the search results for a typed query. */
  SEARCH: 'search',
  /** "Other make" / "Use '<typed>'" — a free-typed name. */
  CUSTOM: 'custom',
  /** A make-only quick chip under "Not sure" (make only). */
  CHIP: 'chip',
  /** Prefilled from the web→app pending intent. */
  INTENT: 'intent',
  /** Restored from the bike draft of an earlier visit. */
  RESTORED: 'restored',
  NONE: 'none',
} as const;
export type BikePickedVia = (typeof BIKE_PICKED_VIA)[keyof typeof BIKE_PICKED_VIA];

/** A background longer than this ends the visit as `left`. */
export const BACKGROUND_LEFT_MS = 30 * 60 * 1000;

export interface BikeSetupSession {
  startedAt: number;
  startYear: string;
  makeQueries: number;
  modelQueries: number;
  /** Last search text per field, kept only to count empty → non-empty starts. */
  lastMakeQuery: string;
  lastModelQuery: string;
  makePickedVia: BikePickedVia;
  modelPickedVia: BikePickedVia;
  /** Duration of the last models fetch that finished in this visit. */
  modelFetchMs: number | null;
}

/** The event's properties (`variant`/`step`/`step_index` are added by trackOnboardingEvent). */
export type BikeSetupSummary = {
  outcome: BikeSetupOutcome;
  duration_ms: number;
  make_queries: number;
  model_queries: number;
  make_picked_via: BikePickedVia;
  model_picked_via: BikePickedVia;
  model_list_size: number;
  model_fetch_ms: number | null;
  year_changed: boolean;
};

export function startSession(
  now: number,
  year: string,
  picked: { make: BikePickedVia; model: BikePickedVia },
): BikeSetupSession {
  return {
    startedAt: now,
    startYear: year,
    makeQueries: 0,
    modelQueries: 0,
    lastMakeQuery: '',
    lastModelQuery: '',
    makePickedVia: picked.make,
    modelPickedVia: picked.model,
    modelFetchMs: null,
  };
}

/** A search counts once when its field goes from empty to non-empty, not per keystroke. */
export function isNewQuery(previous: string, next: string): boolean {
  return previous.trim().length === 0 && next.trim().length > 0;
}

export function buildSummary(
  session: BikeSetupSession,
  outcome: BikeSetupOutcome,
  endedAt: number,
  current: { year: string; modelListSize: number },
): BikeSetupSummary {
  return {
    outcome,
    duration_ms: Math.max(0, Math.round(endedAt - session.startedAt)),
    make_queries: session.makeQueries,
    model_queries: session.modelQueries,
    make_picked_via: session.makePickedVia,
    model_picked_via: session.modelPickedVia,
    model_list_size: current.modelListSize,
    model_fetch_ms: session.modelFetchMs,
    year_changed: current.year !== session.startYear,
  };
}

// ── Pending summary (survives process death) ─────────────────────
// Written when the app goes to the background mid-visit; cleared whenever the
// visit ends. Still present on the next mount ⇒ the process died while the
// rider was on this step, so that visit is reported as `left`.

const storage = createMMKV({ id: 'bike-setup-telemetry' });
const PENDING_KEY = 'pending-summary';

export function savePendingSummary(summary: BikeSetupSummary): void {
  storage.set(PENDING_KEY, JSON.stringify(summary));
}

export function clearPendingSummary(): void {
  storage.remove(PENDING_KEY);
}

export function takePendingSummary(): BikeSetupSummary | null {
  const raw = storage.getString(PENDING_KEY);
  if (!raw) return null;
  clearPendingSummary();
  try {
    return JSON.parse(raw) as BikeSetupSummary;
  } catch {
    return null;
  }
}
