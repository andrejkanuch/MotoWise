/**
 * Rider count for the Reveal's community line, or null to hide the line.
 * Never invent a number: with no riders of this make there is nothing true to say.
 */
export function getRevealRiderCount(riderCount: number | null | undefined): number | null {
  return riderCount && riderCount > 0 ? riderCount : null;
}
