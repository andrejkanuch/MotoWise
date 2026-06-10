/**
 * Shared cursor codec + connection builder for the API's Relay-style pagination.
 *
 * Before this helper the cursor encode/decode logic and the
 * limit+1 → hasNextPage → slice → edges → pageInfo dance were copy-pasted
 * across ~17 paginated resolvers. Centralising it removes that duplication and,
 * crucially, keeps the injection-defence validation in one auditable place:
 * decoded cursor parts are interpolated into PostgREST `.or()` / `.lt()` /
 * `.gt()` filter strings at the call sites, so `decodeCursor` must reject
 * anything that isn't a well-formed ISO date/timestamp or UUID.
 */

/**
 * `YYYY-MM-DD`, optionally followed by an ISO time component. Fully anchored
 * (no trailing junk) so a cursor part like `2026-01-01,id.eq.0));drop ...`
 * — which the old prefix-only call-site regexes would have let through — is
 * rejected before it ever reaches a PostgREST filter string.
 */
const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}([T ]\d{2}:\d{2}:\d{2}(\.\d{1,6})?(Z|[+-]\d{2}:?\d{2})?)?$/;
/** RFC-4122-shaped UUID (any version) — matches the UUID_RE used at call sites. */
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Encodes opaque cursor parts as base64. Parts are joined with `'|'`, so they
 * must not themselves contain that delimiter (timestamps and UUIDs never do).
 *
 * - `encodeCursor(startDate, id)` → composite keyset cursor (trips)
 * - `encodeCursor(timestamp)` → legacy single-field cursor (rides, feed, …)
 */
export function encodeCursor(...parts: string[]): string {
  return Buffer.from(parts.join('|')).toString('base64');
}

/**
 * Decodes a base64 cursor back into its parts, validating that each part is a
 * shape we're willing to interpolate into a PostgREST filter string. Returns
 * `null` (never throws) on any malformed input so callers can treat a bad
 * cursor as "no cursor" or raise their own `BadRequestException`.
 *
 * Validation rules, applied per-part:
 * - a part matching {@link ISO_DATE_RE} (ISO date or timestamp) is allowed
 * - a part matching {@link UUID_RE} (UUID) is allowed
 * - anything else → the whole cursor is rejected (`null`)
 *
 * Legacy single-field cursors (just a timestamp, no UUID) still parse — old
 * mobile bundles hold these mid-scroll and must not break.
 */
export function decodeCursor(cursor: string): string[] | null {
  try {
    const decoded = Buffer.from(cursor, 'base64').toString('utf-8');
    if (decoded.length === 0) return null;
    const parts = decoded.split('|');
    for (const part of parts) {
      if (!ISO_DATE_RE.test(part) && !UUID_RE.test(part)) return null;
    }
    return parts;
  } catch {
    return null;
  }
}

/** Clamps a requested page size to `[1, max]` (default max 50). */
export function clampFirst(first: number, max = 50): number {
  if (!Number.isFinite(first) || first < 1) return 1;
  return Math.min(Math.trunc(first), max);
}

/** A single Relay edge. */
export interface Edge<TNode> {
  node: TNode;
  cursor: string;
}

/**
 * `pageInfo` shape for the forward-only connections that don't expose a
 * `hasPreviousPage` field (trips, group-rides) — `{ hasNextPage, endCursor? }`.
 */
export interface ForwardPageInfo {
  hasNextPage: boolean;
  endCursor?: string;
}

/**
 * `pageInfo` shape for connections that also expose backward markers
 * (rides, articles, follows) — matches the shared `PageInfo` GraphQL model.
 */
export interface FullPageInfo extends ForwardPageInfo {
  hasPreviousPage: boolean;
  startCursor?: string;
}

/** A forward-only connection: edges + `{ hasNextPage, endCursor? }` pageInfo. */
export interface Connection<TNode> {
  edges: Edge<TNode>[];
  pageInfo: ForwardPageInfo;
}

/**
 * A connection that also exposes backward markers + an exact `totalCount`,
 * matching the rides/articles/follows GraphQL connection types.
 */
export interface CountedConnection<TNode> {
  edges: Edge<TNode>[];
  pageInfo: FullPageInfo;
  totalCount: number;
}

interface BuildConnectionArgsBase<TRow, TNode> {
  /** Raw rows fetched with `limit + 1` (the +1 detects `hasNextPage`). */
  rows: TRow[];
  /** The page size (`limit`, NOT `limit + 1`). */
  limit: number;
  /** Maps a row to its GraphQL node. */
  mapNode: (row: TRow) => TNode;
  /** Derives the opaque cursor for a row (typically `encodeCursor(...)`). */
  cursorOf: (row: TRow) => string;
  /** Optional exact/estimated total — emitted as `totalCount` when provided. */
  totalCount?: number;
}

export interface BuildConnectionArgs<TRow, TNode> extends BuildConnectionArgsBase<TRow, TNode> {
  /**
   * Whether a previous page exists — `!!after` at most call sites. When
   * provided (together with `totalCount`), `pageInfo.hasPreviousPage` and
   * `startCursor` are emitted and the return type widens to
   * {@link CountedConnection}.
   */
  hasPreviousPage?: boolean;
}

/**
 * Performs the standard limit+1 → hasNextPage → slice → edges → pageInfo dance.
 * `rows` is expected to have been fetched with `limit + 1`; the extra row (if
 * present) sets `hasNextPage` and is dropped from the emitted edges.
 *
 * Overloaded so callers that pass `totalCount` + `hasPreviousPage` get a
 * {@link CountedConnection} (backward markers + exact `totalCount`) and those
 * that don't get a forward-only {@link Connection} — matching the two GraphQL
 * connection variants.
 */
export function buildConnection<TRow, TNode>(
  args: BuildConnectionArgsBase<TRow, TNode> & {
    totalCount: number;
    hasPreviousPage: boolean;
  },
): CountedConnection<TNode>;
export function buildConnection<TRow, TNode>(
  args: BuildConnectionArgsBase<TRow, TNode>,
): Connection<TNode>;
export function buildConnection<TRow, TNode>({
  rows,
  limit,
  mapNode,
  cursorOf,
  totalCount,
  hasPreviousPage,
}: BuildConnectionArgs<TRow, TNode>): Connection<TNode> | CountedConnection<TNode> {
  const hasNextPage = rows.length > limit;
  const sliced = hasNextPage ? rows.slice(0, limit) : rows;

  const edges: Edge<TNode>[] = sliced.map((row) => ({
    node: mapNode(row),
    cursor: cursorOf(row),
  }));

  if (hasPreviousPage !== undefined || totalCount !== undefined) {
    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: hasPreviousPage ?? false,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: totalCount ?? 0,
    };
  }

  return {
    edges,
    pageInfo: {
      hasNextPage,
      endCursor: edges[edges.length - 1]?.cursor,
    },
  };
}
