// -------------------------------------------------------------------
// RevenueCat paywall config validation
// -------------------------------------------------------------------
// RevenueCat's Android (Jetpack Compose) paywall renderer converts every
// component `margin` and `padding` into Compose `PaddingValues`, which reject
// negative values: `IllegalArgumentException: Padding must be non-negative`.
// This is a FATAL, uncaught crash on Android — iOS silently tolerates negatives.
// (Sentry MOTO-VAULT-REACT-NATIVE-1N — negative margin.top on a badge in the
// live paywall crashed the PaywallActivity on Android.)
//
// These helpers scan a RevenueCat paywall component tree (as returned by the
// RC API `get-paywall?expand=components`) for negative spacing so the failure
// mode can be caught before it ships, rather than from production crash reports.
// -------------------------------------------------------------------

/** Spacing object keys that RevenueCat feeds into Compose PaddingValues. */
export const SPACING_KEYS = ['margin', 'padding'] as const;
export type SpacingKey = (typeof SPACING_KEYS)[number];

/** Edges of a margin/padding object. */
export const SPACING_EDGES = ['top', 'bottom', 'leading', 'trailing', 'left', 'right'] as const;
export type SpacingEdge = (typeof SPACING_EDGES)[number];

export interface NegativeSpacing {
  /** Dot/bracket path to the offending value, e.g. "components[2].margin.top". */
  path: string;
  /** Which spacing object it lived in. */
  spacing: SpacingKey;
  /** Which edge was negative. */
  edge: SpacingEdge;
  /** The offending value. */
  value: number;
  /** The `id` of the nearest enclosing component, if present — aids dashboard lookup. */
  componentId?: string;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function scanSpacingObject(
  spacing: SpacingKey,
  obj: Record<string, unknown>,
  basePath: string,
  componentId: string | undefined,
  out: NegativeSpacing[],
): void {
  for (const edge of SPACING_EDGES) {
    const value = obj[edge];
    if (typeof value === 'number' && value < 0) {
      out.push({ path: `${basePath}.${edge}`, spacing, edge, value, componentId });
    }
  }
}

/**
 * Recursively walk a RevenueCat paywall component tree and collect every
 * negative `margin`/`padding` edge. An empty array means the tree is safe to
 * render on Android.
 */
export function findNegativePaywallSpacing(node: unknown, path = 'root'): NegativeSpacing[] {
  const out: NegativeSpacing[] = [];

  const walk = (current: unknown, currentPath: string, inheritedId: string | undefined): void => {
    if (Array.isArray(current)) {
      current.forEach((child, i) => {
        walk(child, `${currentPath}[${i}]`, inheritedId);
      });
      return;
    }
    if (!isRecord(current)) return;

    // Track the nearest component id for actionable reporting.
    const componentId = typeof current.id === 'string' ? current.id : inheritedId;

    for (const [key, value] of Object.entries(current)) {
      const childPath = `${currentPath}.${key}`;
      if ((SPACING_KEYS as readonly string[]).includes(key) && isRecord(value)) {
        scanSpacingObject(key as SpacingKey, value, childPath, componentId, out);
      }
      // Recurse regardless — spacing objects don't nest further, but everything else can.
      walk(value, childPath, componentId);
    }
  };

  walk(node, path, undefined);
  return out;
}
