// garage_first "Open my garage" handoff (onboarding paywall A/B, 2026-10-07).
//
// The payoff CTA presents the onboarding paywall, then opens the garage whatever
// the result: purchase, close, not presented, a presentation error, or the
// escape link the screen shows when the paywall stalls. Kept out of the screen
// so the settle-once contract is testable without rendering it.

/** Results the handoff produces itself, next to the paywall's own results. */
export const GARAGE_PAYWALL_RESULT = {
  /** `present` rejected — a bug, since presentPaywall resolves its own failures. */
  PRESENTATION_FAILED: 'presentation_failed',
  /** The rider took the escape link before the paywall settled. */
  ESCAPE_HATCH: 'escape_hatch',
} as const;

export interface GaragePaywallHandoffDeps {
  /** Present the paywall. `shouldAbort` turns true once the handoff settled. */
  present: (shouldAbort: () => boolean) => Promise<string>;
  /** Runs once, on the first open (exposure event, pending UI). */
  onStart: () => void;
  /** Runs exactly once with the first result; the rider goes to the garage. */
  onSettled: (result: string) => void;
  onError: (error: unknown) => void;
}

export interface GaragePaywallHandoff {
  /** "Open my garage". Repeated taps after the first are ignored. */
  open: () => void;
  /** The escape link: settles immediately; a late paywall result is dropped. */
  escape: () => void;
  isSettled: () => boolean;
}

export function createGaragePaywallHandoff(deps: GaragePaywallHandoffDeps): GaragePaywallHandoff {
  let started = false;
  let settled = false;

  const settle = (result: string) => {
    if (settled) return;
    settled = true;
    deps.onSettled(result);
  };

  return {
    open: () => {
      if (started) return;
      started = true;
      deps.onStart();
      deps
        .present(() => settled)
        .then(settle, (error: unknown) => {
          deps.onError(error);
          settle(GARAGE_PAYWALL_RESULT.PRESENTATION_FAILED);
        });
    },
    escape: () => settle(GARAGE_PAYWALL_RESULT.ESCAPE_HATCH),
    isSettled: () => settled,
  };
}
