/**
 * Application event names. Three modules share `ride.completed`; a typo in any of
 * them silently breaks the pipeline, so the literal lives in exactly one place.
 */
export const RIDE_EVENTS = {
  COMPLETED: 'ride.completed',
} as const;

export interface RideCompletedEvent {
  rideId: string;
  userId: string;
  locale: string;
  /**
   * Set when the SYSTEM ended this ride rather than the rider (`idle_timeout` from
   * the hourly idle sweep, `stale_on_start` when a newer ride superseded it).
   *
   * Such a ride still belongs in rollups — the rider really did cover that distance
   * — but its GPS track is partial by definition, since the only rides the sweep
   * ends are ones that stopped reporting. Listeners that would present that partial
   * track as a complete ride must opt out.
   */
  autoEndedReason?: string | null;
}
