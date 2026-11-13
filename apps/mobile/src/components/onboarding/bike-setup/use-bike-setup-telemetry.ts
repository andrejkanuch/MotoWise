import { useFocusEffect, useNavigation } from 'expo-router';
import { useCallback, useEffect, useMemo, useRef } from 'react';
import { AppState } from 'react-native';
import { OB_SCREEN } from '@/config/onboarding';
import { AnalyticsEvent } from '@/lib/analytics';
import { trackOnboardingEvent } from '@/lib/onboarding-analytics';
import {
  BACKGROUND_LEFT_MS,
  BIKE_PICKED_VIA,
  BIKE_SETUP_OUTCOME,
  type BikePickedVia,
  type BikeSetupOutcome,
  type BikeSetupSession,
  type BikeSetupSummary,
  buildSummary,
  clearPendingSummary,
  isNewQuery,
  savePendingSummary,
  startSession,
  takePendingSummary,
} from './bike-setup-telemetry';

/** Navigation actions that mean the rider went back (hardware Back, iOS swipe, header back). */
const BACK_ACTION_TYPES: ReadonlySet<string> = new Set(['GO_BACK', 'POP', 'POP_TO_TOP']);

export interface BikeSetupTelemetry {
  noteMakeQuery: (text: string) => void;
  noteModelQuery: (text: string) => void;
  /** A make was picked (or cleared with NONE); the model selection resets with it. */
  noteMakePicked: (via: BikePickedVia) => void;
  noteModelPicked: (via: BikePickedVia) => void;
  /** Number of models loaded for the current make/year (`model_list_size`). */
  noteModelListSize: (size: number) => void;
  /**
   * Call on every render with the models query's key and whether it is fetching
   * (`fetchStatus !== 'idle'`). `model_fetch_ms` is the whole fetch cycle the rider
   * waited through: every retry attempt and the backoff between them, failures included.
   */
  noteModelFetch: (key: string, fetching: boolean) => void;
  /** Ends the visit and fires `bike_setup_summary`; later calls in the same visit do nothing. */
  finish: (outcome: BikeSetupOutcome) => void;
}

interface Options {
  /** The year field's current value (`year_changed` compares it with the value at visit start). */
  year: string;
  /** The make/model restored from the bike draft at mount. */
  restored: { make: boolean; model: boolean };
}

function emit(summary: BikeSetupSummary) {
  trackOnboardingEvent(AnalyticsEvent.BIKE_SETUP_SUMMARY, OB_SCREEN.BIKE_SETUP, summary);
}

/** Counters and the once-per-visit `bike_setup_summary` event for the onboarding bike-setup step (issue 365 T04c). */
export function useBikeSetupTelemetry({ year, restored }: Options) {
  const navigation = useNavigation();
  const sessionRef = useRef<BikeSetupSession | null>(null);
  const currentRef = useRef({ year, modelListSize: 0 });
  currentRef.current.year = year;
  // The make/model selection outlives a visit (Continue, then Back): the next
  // visit starts from how the selection on screen was made.
  const pickedRef = useRef({
    make: restored.make ? BIKE_PICKED_VIA.RESTORED : BIKE_PICKED_VIA.NONE,
    model: restored.model ? BIKE_PICKED_VIA.RESTORED : BIKE_PICKED_VIA.NONE,
  } as { make: BikePickedVia; model: BikePickedVia });
  const focusedRef = useRef(false);
  const pendingCheckedRef = useRef(false);
  const backgroundAtRef = useRef<number | null>(null);
  const removeActionRef = useRef<string | null>(null);
  // The open models fetch cycle; it lives outside the visit so a cycle that spans
  // a visit boundary is still timed from its real start.
  const modelFetchRef = useRef<{ key: string; startedAt: number } | null>(null);

  const begin = useCallback(() => {
    sessionRef.current = startSession(Date.now(), currentRef.current.year, pickedRef.current);
  }, []);

  const end = useCallback((outcome: BikeSetupOutcome, endedAt: number) => {
    const session = sessionRef.current;
    if (!session) return;
    sessionRef.current = null;
    pickedRef.current = { make: session.makePickedVia, model: session.modelPickedVia };
    clearPendingSummary();
    emit(buildSummary(session, outcome, endedAt, currentRef.current));
  }, []);

  useFocusEffect(
    useCallback(() => {
      focusedRef.current = true;
      if (!pendingCheckedRef.current) {
        pendingCheckedRef.current = true;
        // The process died during an earlier visit: report it now, as `left`.
        const pending = takePendingSummary();
        if (pending) emit({ ...pending, outcome: BIKE_SETUP_OUTCOME.LEFT });
      }
      if (!sessionRef.current) begin();
      return () => {
        focusedRef.current = false;
      };
    }, [begin]),
  );

  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      const now = Date.now();
      if (state === 'background') {
        const session = sessionRef.current;
        if (!session) return;
        backgroundAtRef.current = now;
        savePendingSummary(buildSummary(session, BIKE_SETUP_OUTCOME.LEFT, now, currentRef.current));
        return;
      }
      if (state !== 'active' || backgroundAtRef.current === null) return;
      const backgroundAt = backgroundAtRef.current;
      backgroundAtRef.current = null;
      if (now - backgroundAt <= BACKGROUND_LEFT_MS) return;
      end(BIKE_SETUP_OUTCOME.LEFT, backgroundAt);
      if (focusedRef.current) begin();
    });
    return () => sub.remove();
  }, [begin, end]);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      removeActionRef.current = event.data.action.type;
    });
    return () => {
      unsubscribe();
      // Unmounted mid-visit: a back gesture / hardware Back, or the stack was replaced.
      const action = removeActionRef.current;
      end(
        action && BACK_ACTION_TYPES.has(action) ? BIKE_SETUP_OUTCOME.BACK : BIKE_SETUP_OUTCOME.LEFT,
        Date.now(),
      );
    };
  }, [navigation, end]);

  return useMemo<BikeSetupTelemetry>(
    () => ({
      noteMakeQuery: (text) => {
        const session = sessionRef.current;
        if (!session) return;
        if (isNewQuery(session.lastMakeQuery, text)) session.makeQueries += 1;
        session.lastMakeQuery = text;
      },
      noteModelQuery: (text) => {
        const session = sessionRef.current;
        if (!session) return;
        if (isNewQuery(session.lastModelQuery, text)) session.modelQueries += 1;
        session.lastModelQuery = text;
      },
      noteMakePicked: (via) => {
        pickedRef.current = { make: via, model: BIKE_PICKED_VIA.NONE };
        const session = sessionRef.current;
        if (!session) return;
        session.makePickedVia = via;
        session.modelPickedVia = BIKE_PICKED_VIA.NONE;
      },
      noteModelPicked: (via) => {
        pickedRef.current = { ...pickedRef.current, model: via };
        if (sessionRef.current) sessionRef.current.modelPickedVia = via;
      },
      noteModelListSize: (size) => {
        currentRef.current.modelListSize = size;
      },
      noteModelFetch: (key, fetching) => {
        const open = modelFetchRef.current;
        if (fetching) {
          // A new make/year starts a new cycle; retries of the same key continue it.
          if (open?.key !== key) modelFetchRef.current = { key, startedAt: Date.now() };
          return;
        }
        if (!open) return;
        modelFetchRef.current = null;
        // The rider moved to another make/year before it finished: no wait to report.
        if (open.key !== key) return;
        if (sessionRef.current) {
          sessionRef.current.modelFetchMs = Math.round(Date.now() - open.startedAt);
        }
      },
      finish: (outcome) => end(outcome, Date.now()),
    }),
    [end],
  );
}
