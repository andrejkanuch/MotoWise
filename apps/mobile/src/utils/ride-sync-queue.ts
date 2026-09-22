import {
  DeleteRideDocument,
  EndRideDocument,
  StartRideDocument,
  UpdateRideDocument,
  UploadWaypointsDocument,
} from '@motovault/graphql';
import { RIDE_SYNC_LIMITS, RIDE_WAYPOINT_LIMITS, type Waypoint } from '@motovault/types';
import { compareAsc, isValid, parseISO } from 'date-fns';
import * as Network from 'expo-network';
import { createMMKV } from 'react-native-mmkv';
import { captureException } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { hasGraphQLCode } from '../lib/graphql-errors';
import { isNetworkError } from '../lib/network-error';
import { getSecureItemSync, SECURE_STORE_KEY } from '../lib/secure-store';
import { useAuthStore } from '../stores/auth.store';

// --- Types ---

type SyncOperationType = 'startRide' | 'uploadWaypoints' | 'endRide' | 'updateRide' | 'deleteRide';

// Lookup map: resolve GraphQL documents from operation type string.
// TypedDocumentNode objects can't be serialized to MMKV JSON, so we
// store only the type string and resolve the document at execution time.
// biome-ignore lint/suspicious/noExplicitAny: documents have heterogeneous generic params
const MUTATION_DOCUMENT_MAP: Record<SyncOperationType, any> = {
  startRide: StartRideDocument,
  uploadWaypoints: UploadWaypointsDocument,
  endRide: EndRideDocument,
  updateRide: UpdateRideDocument,
  deleteRide: DeleteRideDocument,
};

interface SyncOperation {
  seq: number;
  type: SyncOperationType;
  payload: Record<string, unknown>;
  retries: number;
  createdAt: string;
  /**
   * Supabase id of the rider who enqueued this op.
   *
   * The queue is device-global and deliberately SURVIVES sign-out (see the
   * data-preservation branch in `_layout.tsx`), so without this field rider A's
   * unsynced ride is drained under rider B's JWT on the next sign-in — and
   * `startRide` stamps `user_id` from whatever JWT presents it, so A's GPS track
   * lands in B's account. Stamped at enqueue, enforced at drain by
   * `isOwnedByCurrentSession`.
   *
   * Optional only because ops written before this field existed are still in
   * MMKV; `claimLegacyOpsForCurrentSession` retires that case once, at upgrade.
   */
  userId?: string;
}

// --- MMKV instance ---

const syncStorage = createMMKV({ id: 'ride-sync-queue' });

const QUEUE_KEY = 'sync.queue';
const DEAD_LETTER_KEY = 'sync.dead_letter';
const SEQ_KEY = 'sync.seq';
/** Marks which one-time dead-letter redrive this install has already run. */
const REDRIVE_VERSION_KEY = 'sync.redrive_version';
/** Version of the one-time legacy-ownership claim that has already run. */
const OWNERSHIP_CLAIM_KEY = 'sync.ownership_claim_version';
const OWNERSHIP_CLAIM_VERSION = 1;
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

/**
 * Bump when a server fix makes previously-undeliverable dead-lettered ops
 * deliverable again, to redrive them ONCE on the next launch.
 *
 * 1 — `startRide` became idempotent on `rideId` and stopped reporting transient
 *     SQLSTATEs as permanent (Sentry MOTO-VAULT-REACT-NATIVE-3C). Ops stranded by
 *     that bug — up to a whole ride each — only become replayable once that server
 *     change is live, which is why the API half MUST ship first: redriving against
 *     the old server replays every op straight back into the same 400s.
 */
const DEAD_LETTER_REDRIVE_VERSION = 1;

// GraphQL error codes that will never succeed on retry — dead-letter immediately
// instead of burning the retry budget (and head-of-line-blocking the queue).
//
// UNAUTHENTICATED is deliberately ABSENT: see `isAuthError`. It is not permanent,
// and treating it as merely-retryable was destroying recorded rides.
const NON_RETRYABLE_CODES = ['FORBIDDEN', 'BAD_USER_INPUT', 'BAD_REQUEST', 'NOT_FOUND'] as const;

function isNonRetryableError(error: unknown): boolean {
  return NON_RETRYABLE_CODES.some((code) => hasGraphQLCode(error, code));
}

/**
 * A missing/expired JWT — recoverable the moment auth is restored, never a reason
 * to discard a ride.
 *
 * This was the top production error (MOTO-VAULT-REACT-NATIVE-1J: 1209 events, 10
 * users). `UNAUTHENTICATED` fell through to the "retryable server error" branch, so
 * a backgrounded ride whose keychain was locked burned all 5 retries in ~31s of
 * backoff (1+2+4+8+16 — matching the 32.5s `ageMs` on the reported events) and then
 * dead-lettered a fully recorded ride. Auth outages last minutes-to-hours, not
 * seconds, so the retry budget can never outlast one; the only correct response is
 * to stop draining and wait, exactly as for a network outage.
 */
function isAuthError(error: unknown): boolean {
  return hasGraphQLCode(error, 'UNAUTHENTICATED');
}

/**
 * Where each operation's ride id lives inside its serialized payload. Ride ops are
 * a DEPENDENCY CHAIN keyed by this id, which is what makes group dead-lettering
 * possible at all — see the permanent-failure branch in `drainPass`.
 *
 * A path table rather than a switch so adding an op type is a one-line data change,
 * and so the shapes are stated in one place: every mutation but `deleteRide` nests
 * its id under `input`; `deleteRide` takes a bare `id` variable.
 */
const RIDE_ID_PAYLOAD_PATH: Record<SyncOperationType, readonly string[]> = {
  startRide: ['variables', 'input', 'rideId'],
  uploadWaypoints: ['variables', 'input', 'rideId'],
  endRide: ['variables', 'input', 'rideId'],
  updateRide: ['variables', 'input', 'rideId'],
  deleteRide: ['variables', 'id'],
};

/**
 * The ride an op belongs to, or null when the payload does not carry one (a
 * malformed or older-shape entry restored from MMKV). Walks `unknown` rather than
 * casting, so a shape change degrades to "ungrouped" instead of throwing on the
 * ride hot path.
 */
function rideIdOf(op: SyncOperation): string | null {
  let cursor: unknown = op.payload;
  for (const key of RIDE_ID_PAYLOAD_PATH[op.type] ?? []) {
    if (typeof cursor !== 'object' || cursor === null) return null;
    cursor = (cursor as Record<string, unknown>)[key];
  }
  return typeof cursor === 'string' && cursor.length > 0 ? cursor : null;
}

// Notified (with the current dead-letter count) whenever drainQueue dead-letters
// one or more ops, so the app can surface a "rides failed to sync" prompt with a
// retry path. Registered once from the root layout.
let onDeadLetter: ((deadLetterCount: number) => void) | null = null;

export function setDeadLetterListener(listener: ((deadLetterCount: number) => void) | null): void {
  onDeadLetter = listener;
}

// --- Monotonic sequence counter ---

function nextSeq(): number {
  const current = syncStorage.getNumber(SEQ_KEY) ?? 0;
  const next = current + 1;
  syncStorage.set(SEQ_KEY, next);
  return next;
}

// --- Queue operations (single JSON array in MMKV, ordered by seq) ---

function getQueue(): SyncOperation[] {
  const raw = syncStorage.getString(QUEUE_KEY);
  if (!raw) return [];
  // Insertion order already guarantees seq ordering (monotonic counter)
  return JSON.parse(raw) as SyncOperation[];
}

function setQueue(queue: SyncOperation[]): void {
  syncStorage.set(QUEUE_KEY, JSON.stringify(queue));
}

// Remove a single delivered op by seq, re-reading the live queue so an op
// appended by a concurrent enqueue (while drainQueue awaited the network) is
// preserved rather than clobbered by a stale snapshot.
function removeOpBySeq(seq: number): void {
  setQueue(getQueue().filter((op) => op.seq !== seq));
}

// Bump the retry count of a single op by seq against the live queue.
function bumpRetryBySeq(seq: number): void {
  setQueue(getQueue().map((op) => (op.seq === seq ? { ...op, retries: op.retries + 1 } : op)));
}

function getDeadLetterQueue(): SyncOperation[] {
  const raw = syncStorage.getString(DEAD_LETTER_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SyncOperation[];
}

function setDeadLetterQueue(dlq: SyncOperation[]): void {
  syncStorage.set(DEAD_LETTER_KEY, JSON.stringify(dlq));
}

/**
 * Oldest first. `createdAt` is the real age, but entries restored from older builds
 * (and the fixtures that mimic them) can carry an unparseable value, so `seq` — a
 * monotonic counter, hence a perfect age proxy — is both the tiebreak and the
 * fallback. Comparison goes through date-fns rather than hand-rolled `Date` math.
 */
function compareByAge(a: SyncOperation, b: SyncOperation): number {
  const left = parseISO(a.createdAt);
  const right = parseISO(b.createdAt);
  if (isValid(left) && isValid(right)) {
    const byDate = compareAsc(left, right);
    if (byDate !== 0) return byDate;
  }
  return a.seq - b.seq;
}

/**
 * Hold the dead-letter queue to `MAX_DEAD_LETTER_OPS`, evicting oldest-first.
 *
 * Eviction is reported SEPARATELY from a dead-letter, and deliberately so: a
 * dead-letter is "we could not deliver this, it is still on the device and a
 * redrive may yet save it", while an eviction is unambiguous, irreversible data
 * loss — the payload was the only remaining copy of those GPS fixes.
 *
 * Survivors keep their original array order; only the evicted set is chosen by age.
 */
function boundDeadLetterQueue(dlq: SyncOperation[]): SyncOperation[] {
  const overflow = dlq.length - RIDE_SYNC_LIMITS.MAX_DEAD_LETTER_OPS;
  if (overflow <= 0) return dlq;

  const evicted = [...dlq].sort(compareByAge).slice(0, overflow);
  const evictedSeqs = new Set(evicted.map((op) => op.seq));

  captureException(new Error(`Ride sync dead-letter evicted: ${overflow} op(s) discarded`), {
    source: 'ride-sync-queue.evictDeadLetter',
    evictedCount: String(overflow),
    evictedOpTypes: [...new Set(evicted.map((op) => op.type))].join(','),
    evictedRideIds: [...new Set(evicted.map(rideIdOf).filter(Boolean))].join(','),
    oldestEvictedAt: evicted[0]?.createdAt ?? 'unknown',
    deadLetterQueueLength: String(RIDE_SYNC_LIMITS.MAX_DEAD_LETTER_OPS),
  });

  return dlq.filter((op) => !evictedSeqs.has(op.seq));
}

/**
 * Park a whole GROUP of ops — one ride's worth — with a SINGLE report.
 *
 * Ride ops are a dependency chain keyed by `rideId`, so a permanently-failed head
 * takes its dependents with it (see `drainPass`). Reporting once per group instead
 * of once per op is what turns a 107-event Sentry storm into one event, and it is
 * what makes the dead-letter count mean "rides" rather than "50-waypoint chunks".
 */
function moveGroupToDeadLetter(ops: readonly SyncOperation[], error?: unknown): void {
  if (ops.length === 0) return;
  const [head] = ops;
  const dlq = boundDeadLetterQueue([...getDeadLetterQueue(), ...ops]);
  setDeadLetterQueue(dlq);

  // A dead-lettered ride op is silent data loss — always report it with enough
  // context to identify which op/ride and how long it had been queued.
  captureException(
    error instanceof Error ? error : new Error(`Ride sync dead-letter: ${head.type}`),
    {
      source: 'ride-sync-queue.moveToDeadLetter',
      opType: head.type,
      seq: String(head.seq),
      retries: String(head.retries),
      ageMs: String(Date.now() - new Date(head.createdAt).getTime()),
      deadLetterQueueLength: String(dlq.length),
      rideId: rideIdOf(head) ?? 'unknown',
      groupSize: String(ops.length),
      groupOpTypes: ops.map((op) => op.type).join(','),
    },
  );
}

/**
 * Queued ops that can no longer possibly succeed because `failed` did not.
 *
 * ONLY a failed `startRide` has dependents. The chain is
 * startRide -> uploadWaypoints x N -> endRide, and only `startRide` creates the
 * `rides` row the rest need: without it every waypoint chunk 404s and `endRide`
 * 400s, so parking them together is the whole point. Every OTHER op type has no
 * dependents at all — a single bad waypoint batch (a denormal float, say, or one
 * that exhausts its retries on a 5xx) costs the rider that batch and nothing
 * else. Without this gate it took the rest of the ride with it, `endRide`
 * included, turning a lost chunk into a lost ride — the exact outcome this whole
 * change set exists to prevent.
 *
 * Ops for other rides are deliberately untouched: they are genuinely independent
 * and must still get their chance. So are ops belonging to another rider — a
 * failure on this device must never reach into someone else's parked data.
 */
function dependentOpsOf(failed: SyncOperation): SyncOperation[] {
  if (failed.type !== 'startRide') return [];
  const rideId = rideIdOf(failed);
  if (!rideId) return [];
  return getQueue().filter(
    (op) => op.seq > failed.seq && rideIdOf(op) === rideId && isOwnedByCurrentSession(op),
  );
}

// --- Ownership (cross-user leak guard) ---

/**
 * The rider this device is currently signed in as, or null.
 *
 * The auth store is the live signal, but it is null during the cold-start /
 * headless window before `supabase.auth.getSession()` resolves — and the
 * background location task enqueues waypoint flushes inside exactly that window.
 * `LAST_USER_ID` closes it: it is written on every identify and CLEARED on
 * sign-out (`clearLastUserId` in the local-cleanup branch of `_layout.tsx`), so
 * it can only ever name the rider signed in on this device right now, never a
 * previous account. Both null means nobody is signed in and nothing may be sent.
 *
 * This fallback is for STAMPING ops we are creating now. It is deliberately not
 * used by `isOwnedByCurrentSession`: deciding who may RECEIVE a queued op must
 * key on the live session only.
 */
function currentOwnerId(): string | null {
  return (
    useAuthStore.getState().session?.user?.id ?? getSecureItemSync(SECURE_STORE_KEY.LAST_USER_ID)
  );
}

/**
 * May the session that is signed in RIGHT NOW deliver this op?
 *
 * Exposed as a named predicate rather than inlined at the call site on purpose:
 * a raw `a.userId === b.userId` treats two UNOWNED ops (both `undefined`) as the
 * same owner, which is wrong in principle and a trap for any grouping built on
 * it. Routing every ownership question through here removes that by construction.
 *
 * `dependentOpsOf` groups by this predicate AND `rideId`, so group dead-lettering
 * can never reach across accounts.
 *
 * Signed out (`null`) owns nothing, so a drain with no session sends nothing
 * rather than firing requests the API can only reject.
 */
export function isOwnedByCurrentSession(op: SyncOperation): boolean {
  const sessionUserId = useAuthStore.getState().session?.user?.id ?? null;
  return sessionUserId !== null && op.userId === sessionUserId;
}

/**
 * One-time, marker-guarded claim of ops that predate `userId`.
 *
 * Quarantining legacy ops forever would shred a ride that straddles the upgrade:
 * a pre-upgrade `startRide` could never be sent, while post-upgrade waypoint
 * chunks for the same ride ARE sendable, deliver, find no `rides` row, come back
 * NOT_FOUND and dead-letter one chunk at a time. The ride would be lost AND
 * amplified into a dead-letter pile.
 *
 * So: on the first launch after the upgrade where a session is actually active,
 * stamp every unowned op with that user id. With no session we do nothing AND
 * leave the marker unconsumed, so the claim is retried on a later launch — the
 * owner is only ever taken from a live session, never from a stored leftover.
 *
 * Strictly one-time. This is an upgrade migration, never a standing "adopt
 * unowned ops" rule: that would re-open the very leak this field closes.
 *
 * Accepted residual risk (state it in the PR): A-queues → A-signs-out →
 * B-signs-in → upgrade → B claims A's ops. That exact sequence already leaks in
 * the shipped code, so it is not a regression — it is one bounded window during
 * a single upgrade, after which the leak is closed permanently.
 */
function claimLegacyOpsForCurrentSession(): void {
  if ((syncStorage.getNumber(OWNERSHIP_CLAIM_KEY) ?? 0) >= OWNERSHIP_CLAIM_VERSION) return;

  // Live session only — never `currentOwnerId()`, whose SecureStore fallback is
  // for stamping ops we create, not for deciding whose historical data this is.
  const sessionUserId = useAuthStore.getState().session?.user?.id ?? null;
  if (!sessionUserId) return;

  const claim = (ops: SyncOperation[]): SyncOperation[] =>
    ops.map((op) => (op.userId === undefined ? { ...op, userId: sessionUserId } : op));

  // The dead-letter queue is claimed in the same pass: `redriveDeadLetterQueue`
  // merges it back into the main queue, where an unowned op would be undeliverable
  // for the rest of the install's life.
  setQueue(claim(getQueue()));
  setDeadLetterQueue(claim(getDeadLetterQueue()));
  syncStorage.set(OWNERSHIP_CLAIM_KEY, OWNERSHIP_CLAIM_VERSION);
}

export function enqueue(type: SyncOperationType, payload: Record<string, unknown>): void {
  const queue = getQueue();
  const userId = currentOwnerId();
  queue.push({
    seq: nextSeq(),
    type,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
    // Omitted rather than stored as null when nobody is signed in, so the shape
    // matches a pre-upgrade op and the one-time claim can still adopt it.
    ...(userId === null ? {} : { userId }),
  });
  setQueue(queue);
}

/**
 * Durably enqueue an operation and immediately attempt to drain the queue.
 *
 * We ALWAYS enqueue first (assigning a sequence number synchronously, in call
 * order) instead of racing an inline fetch. The end-of-ride burst fires
 * `uploadWaypoints` then `endRide` back-to-back without awaiting; an inline
 * fast-path let those two run concurrently on an empty queue, so `endRide`
 * could reach the server before its waypoints and corrupt ride reconstruction.
 * Routing every op through the single-flight, seq-ordered drain guarantees
 * in-order delivery — and a transient failure now re-queues in the original
 * position rather than appending behind a later op.
 */
export async function enqueueOrExecute(
  type: SyncOperationType,
  payload: Record<string, unknown>,
): Promise<void> {
  enqueue(type, payload);
  await drainQueue();
}

/**
 * Enqueue a waypoint batch as server-sized uploads and drain once.
 *
 * `UploadWaypointsInputSchema` accepts at most `MAX_PER_UPLOAD` waypoints per
 * mutation; an oversized payload comes back BAD_USER_INPUT, which is
 * non-retryable, so the whole batch dead-letters and those GPS points are gone.
 * Every producer (chunk flush, rider-ended, auto-ended) routes through here so
 * none of them can build one by accident — the graceful-end and auto-end paths
 * upload a crash-restored buffer whose size they do not control.
 *
 * Splitting then draining once (rather than awaiting per chunk) keeps all chunks
 * in a single seq-ordered cycle, so `endRide` still cannot overtake its waypoints.
 */
export function enqueueWaypointUpload(
  rideId: string,
  waypoints: readonly Waypoint[],
): Promise<void> {
  if (waypoints.length === 0) return Promise.resolve();
  for (let i = 0; i < waypoints.length; i += RIDE_WAYPOINT_LIMITS.MAX_PER_UPLOAD) {
    enqueue('uploadWaypoints', {
      variables: {
        input: {
          rideId,
          waypoints: waypoints.slice(i, i + RIDE_WAYPOINT_LIMITS.MAX_PER_UPLOAD),
        },
      },
    });
  }
  return drainQueue();
}

/** The drain cycle currently running, or null. Also the re-entry lock. */
let inFlight: Promise<void> | null = null;
/** A drain was asked for while one was already running — run one more pass. */
let drainRequested = false;

/**
 * Drain the queue, coalescing concurrent requests instead of dropping them.
 *
 * The naive `if (isDraining) return` lost wakeups, and it lost the one this fix
 * depends on: sign-in makes the app `active` BEFORE the session lands, so the
 * app-resume trigger can start a drain that sends with a stale token, and the
 * `SIGNED_IN` trigger then arrives mid-flight and evaporates. The stale request
 * fails UNAUTHENTICATED and head-of-line blocks — with a valid session now in hand,
 * a blocked queue, and no trigger left. Next chance would be app resume, a
 * connectivity change, or the ~1h token refresh.
 *
 * The returned promise resolves when the cycle that includes the caller's request
 * has finished, so awaiting it is a genuine "delivery was attempted" signal even
 * when a drain was already running.
 */
export function drainQueue(): Promise<void> {
  if (inFlight) {
    drainRequested = true;
    return inFlight;
  }
  inFlight = (async () => {
    try {
      do {
        // Cleared before the pass, so a request arriving DURING it schedules another.
        drainRequested = false;
        await drainPass();
      } while (drainRequested);
    } finally {
      inFlight = null;
    }
  })();
  return inFlight;
}

async function drainPass(): Promise<void> {
  // Runs before the network probe so an offline launch still retires the legacy
  // ops; it is a local MMKV rewrite, not a delivery.
  claimLegacyOpsForCurrentSession();

  // A thrown network probe is treated as no-connectivity: leave the queue
  // intact and return so it drains on the next trigger, rather than throwing
  // an unhandled rejection out of a fire-and-forget drainQueue() call.
  let networkState: Network.NetworkState;
  try {
    networkState = await Network.getNetworkStateAsync();
  } catch {
    return;
  }
  if (!networkState.isConnected || !networkState.isInternetReachable) return;

  let deadLettered = 0;

  // Deliver in strict seq order within the signed-in rider's own ops, persisting
  // after EVERY op so an app kill mid-drain can't re-deliver an op that already
  // reached the server. The queue is re-read each pass, so an op enqueued while
  // we were draining (the endRide that lands behind an in-flight
  // uploadWaypoints) is picked up in order within the same drain.
  while (true) {
    // The FIRST op this session owns, not the head. Ops belonging to another
    // rider (or to nobody, pre-claim) are skipped and RETAINED: never sent,
    // never dropped, never dead-lettered — their owner's data survives for them
    // and delivers the moment they sign back in.
    //
    // Termination: this loop advances by REMOVAL, not by a cursor. Every branch
    // below either removes the selected op or breaks, so the queue strictly
    // shrinks on each iteration that does not break. A `continue` past a
    // retained op would re-select it forever and hang the main thread on
    // sign-in — which is why the skip lives in the SELECTION, not in the body.
    const op = getQueue().find(isOwnedByCurrentSession);
    if (!op) break;

    // Exponential backoff with jitter — only sleep on retries, not first attempt
    if (op.retries > 0) {
      const baseDelay = BASE_DELAY_MS * 2 ** op.retries;
      const jitteredDelay = baseDelay * (0.5 + Math.random() * 0.5);
      await sleep(jitteredDelay);
    }

    try {
      await executeSyncOperation(op);
      // Delivered — drop just this op from the live queue and advance.
      removeOpBySeq(op.seq);
    } catch (error) {
      if (isNetworkError(error) || isAuthError(error)) {
        // Transient outage: stop draining and leave this op + everything after
        // it at the head, in order, for the next cycle. Network AND auth errors
        // must NEVER dead-letter (would drop a fully-recorded offline ride), so
        // retries is left untouched — an auth outage that outlasts the retry
        // budget must not be able to convert into data loss.
        //
        // Head-of-line blocking here is intentional and preferable: a queue that
        // waits indefinitely for auth keeps the ride, whereas one that "makes
        // progress" discards it. Recovery is driven by the drain triggers in
        // _layout (app resume, connectivity restore, and auth restored).
        break;
      }

      const nextRetries = op.retries + 1;
      if (isNonRetryableError(error) || nextRetries >= MAX_RETRIES) {
        // Permanent failure. The old code dead-lettered just this op and advanced,
        // on the premise that "later independent ops still get a chance" — false for
        // ride ops, which are a dependency chain keyed by rideId
        // (startRide -> uploadWaypoints x N -> endRide). With no `rides` row every
        // following chunk 404s and endRide 400s: one dead-letter and one Sentry event
        // each, which is how a single long ride became 107 parked ops and 107 events
        // (MOTO-VAULT-REACT-NATIVE-3C, same amplification as -1M).
        //
        // Note the asymmetry the `else` branch below already acknowledges: it
        // head-of-line blocks precisely BECAUSE a later op may be dependent. Take the
        // whole group down together; ops for other rides are untouched and still run.
        const failed = { ...op, retries: nextRetries };
        const group = [failed, ...dependentOpsOf(failed)];
        moveGroupToDeadLetter(group, error);
        for (const member of group) removeOpBySeq(member.seq);
        deadLettered += group.length;
      } else {
        // Retryable server error (e.g. 5xx): bump retries and head-of-line
        // block so a dependent later op can't be delivered ahead of this one.
        bumpRetryBySeq(op.seq);
        captureException(error);
        break;
      }
    }
  }

  if (deadLettered > 0) onDeadLetter?.(getDeadLetterCount());
}

async function executeSyncOperation(op: SyncOperation): Promise<void> {
  // Resolve the GraphQL document from the operation type.
  // TypedDocumentNode objects don't serialize to JSON, so we look them up.
  // gqlFetcher handles JWT refresh automatically — safe for long rides.
  const document = MUTATION_DOCUMENT_MAP[op.type];
  if (!document) throw new Error(`Unknown sync operation type: ${op.type}`);

  const { variables } = op.payload as { variables: Record<string, unknown> };
  try {
    await gqlFetcher(document, variables as never);
  } catch (error) {
    // Deletes are idempotent — NOT_FOUND means the resource is already gone.
    // Don't retry or report these; the desired state is already achieved.
    if (op.type === 'deleteRide' && isNotFoundError(error)) return;
    throw error;
  }
}

export function getQueueLength(): number {
  return getQueue().length;
}

export function getDeadLetterCount(): number {
  return getDeadLetterQueue().length;
}

/**
 * Total unsynced ops — main queue PLUS dead-letter. The single source of truth for
 * "is there rider data we haven't delivered yet".
 *
 * Unsynced work living in two stores while every guard consulted only one is what
 * made the sign-out cleanup destructive: it checked `getQueueLength() === 0`, which
 * is TRUE precisely when everything has already been dead-lettered, and then wiped
 * the dead-letter queue along with it. Any code deciding whether it is safe to
 * discard local ride state must use this, never `getQueueLength`.
 */
export function getPendingCount(): number {
  return getQueue().length + getDeadLetterQueue().length;
}

/** True when any ride op is still undelivered (queued or dead-lettered). */
export function hasPendingSyncWork(): boolean {
  return getPendingCount() > 0;
}

/**
 * Move every dead-lettered op back into the main queue (retries reset) and drain.
 * Used by the "rides failed to sync — retry" affordance. Ops are re-sorted by seq
 * so a redrive preserves the original ordering.
 *
 * Returns the drain promise so a caller can await actual delivery — the only
 * reliable signal, since the drain is single-flight and a separate `drainQueue()`
 * awaits the same cycle rather than starting its own. Correct even when a drain was
 * already running: `drainQueue` coalesces the request into the live cycle, so the
 * returned promise still resolves after the redriven ops have been attempted.
 */
export function redriveDeadLetterQueue(): Promise<void> {
  const dlq = getDeadLetterQueue();
  if (dlq.length === 0) return Promise.resolve();
  const merged = [...getQueue(), ...dlq.map((op) => ({ ...op, retries: 0 }))].sort(
    (a, b) => a.seq - b.seq,
  );
  setQueue(merged);
  syncStorage.remove(DEAD_LETTER_KEY);
  return drainQueue();
}

/**
 * Redrive the dead-letter queue ONCE per shipped server fix, on app launch.
 *
 * Ops stranded by a server-side bug do not self-heal: nothing drains the dead-letter
 * queue automatically, and the only manual route is an `Alert` that in the reported
 * incident fired while the app was backgrounded (so it was never presented) and then
 * latched. Those payloads — waypoints included — are the ONLY remaining copy, since
 * local chunks are dropped once enqueued.
 *
 * The marker is written BEFORE draining, so a crash or kill mid-redrive cannot turn
 * this into a replay loop on every launch; the ops stay in the main queue and drain
 * normally from there.
 *
 * ORDERING IS LOAD-BEARING: this must not reach users before the matching API fix is
 * live, or it replays every parked op into the same permanent failures and produces a
 * fresh Sentry storm. See `DEAD_LETTER_REDRIVE_VERSION`.
 */
export function redriveDeadLetterQueueOnce(): Promise<void> {
  if (syncStorage.getNumber(REDRIVE_VERSION_KEY) === DEAD_LETTER_REDRIVE_VERSION) {
    return Promise.resolve();
  }
  syncStorage.set(REDRIVE_VERSION_KEY, DEAD_LETTER_REDRIVE_VERSION);
  return redriveDeadLetterQueue();
}

/**
 * Clear the DELIVERED queue only — never the dead-letter queue.
 *
 * This is what a sign-out / local-cleanup path should call. It exists because the
 * previous call site imported `clearAll as clearSyncQueue`: an innocuous-looking
 * name for a function that also removes DEAD_LETTER_KEY, so a forced sign-out
 * silently destroyed every parked ride op. Callers that must not lose rider data
 * cannot reach the destructive path from here.
 *
 * Safe by construction: if anything is still pending it does nothing at all, so a
 * caller that forgets to check is not a data-loss bug.
 */
export function clearDeliveredQueue(): void {
  if (hasPendingSyncWork()) return;
  syncStorage.remove(QUEUE_KEY);
  syncStorage.remove(SEQ_KEY);
}

/**
 * Destroy ALL sync state including undelivered and dead-lettered ops.
 *
 * Genuinely destructive — deliberately named so, and deliberately not the thing a
 * sign-out path reaches for. Intended for tests and an explicit user-initiated
 * "discard failed rides" action. Use `clearDeliveredQueue` for cleanup.
 *
 * This is the ONLY exported function that can remove DEAD_LETTER_KEY. The
 * `clearAll` alias and an unused `clearDeadLetterQueue` were both deleted rather
 * than left deprecated: a JSDoc `@deprecated` stops nothing at runtime or in CI, and
 * `clearAll as clearSyncQueue` is the exact import that destroyed rides in
 * production. Making the destructive path unreachable-by-accident is the fix; a
 * comment asking people not to use it is not.
 */
export function destroyAllSyncData(): void {
  syncStorage.remove(QUEUE_KEY);
  syncStorage.remove(DEAD_LETTER_KEY);
  syncStorage.remove(SEQ_KEY);
  syncStorage.remove(REDRIVE_VERSION_KEY);
  // Nothing is left to claim, so re-arming the one-time claim is a no-op in
  // production and lets tests start from a clean slate.
  syncStorage.remove(OWNERSHIP_CLAIM_KEY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNotFoundError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('"code":"NOT_FOUND"') || msg.includes('not found');
}
