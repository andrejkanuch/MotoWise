import {
  DeleteRideDocument,
  EndRideDocument,
  StartRideDocument,
  UpdateRideDocument,
  UploadWaypointsDocument,
} from '@motovault/graphql';
import * as Network from 'expo-network';
import { createMMKV } from 'react-native-mmkv';
import { captureException } from '../lib/analytics';
import { gqlFetcher } from '../lib/graphql-client';
import { hasGraphQLCode } from '../lib/graphql-errors';

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
}

// --- MMKV instance ---

const syncStorage = createMMKV({ id: 'ride-sync-queue' });

const QUEUE_KEY = 'sync.queue';
const DEAD_LETTER_KEY = 'sync.dead_letter';
const SEQ_KEY = 'sync.seq';
const MAX_RETRIES = 5;
const BASE_DELAY_MS = 1000;

// GraphQL error codes that will never succeed on retry — dead-letter immediately
// instead of burning the retry budget (and head-of-line-blocking the queue).
const NON_RETRYABLE_CODES = ['FORBIDDEN', 'BAD_USER_INPUT', 'BAD_REQUEST', 'NOT_FOUND'] as const;

function isNonRetryableError(error: unknown): boolean {
  return NON_RETRYABLE_CODES.some((code) => hasGraphQLCode(error, code));
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

function moveToDeadLetter(op: SyncOperation, error?: unknown): void {
  const dlq = getDeadLetterQueue();
  dlq.push(op);
  syncStorage.set(DEAD_LETTER_KEY, JSON.stringify(dlq));
  // A dead-lettered ride op is silent data loss — always report it with enough
  // context to identify which op/ride and how long it had been queued.
  captureException(
    error instanceof Error ? error : new Error(`Ride sync dead-letter: ${op.type}`),
    {
      source: 'ride-sync-queue.moveToDeadLetter',
      opType: op.type,
      seq: String(op.seq),
      retries: String(op.retries),
      ageMs: String(Date.now() - new Date(op.createdAt).getTime()),
      deadLetterQueueLength: String(dlq.length),
    },
  );
}

export function enqueue(type: SyncOperationType, payload: Record<string, unknown>): void {
  const queue = getQueue();
  queue.push({
    seq: nextSeq(),
    type,
    payload,
    retries: 0,
    createdAt: new Date().toISOString(),
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

let isDraining = false;

export async function drainQueue(): Promise<void> {
  if (isDraining) return;
  isDraining = true;
  try {
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

    // Deliver strictly in seq order, persisting after EVERY op so an app kill
    // mid-drain can't re-deliver an op that already reached the server. The
    // queue is re-read each pass, so an op enqueued while we were draining (the
    // endRide that lands behind an in-flight uploadWaypoints) is picked up in
    // order within the same drain.
    while (true) {
      const queue = getQueue();
      if (queue.length === 0) break;
      const op = queue[0];

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
        if (isNetworkError(error)) {
          // Transient outage: stop draining and leave this op + everything after
          // it at the head, in order, for the next cycle. Network errors must
          // NEVER dead-letter (would drop a fully-recorded offline ride), so
          // retries is left untouched.
          break;
        }

        const nextRetries = op.retries + 1;
        if (isNonRetryableError(error) || nextRetries >= MAX_RETRIES) {
          // Permanent failure — this op will never deliver. Dead-letter it and
          // advance; later independent ops still get a chance.
          moveToDeadLetter({ ...op, retries: nextRetries }, error);
          removeOpBySeq(op.seq);
          deadLettered++;
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
  } finally {
    isDraining = false;
  }
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
 * Move every dead-lettered op back into the main queue (retries reset) and drain.
 * Used by the "rides failed to sync — retry" affordance. Ops are re-sorted by seq
 * so a redrive preserves the original ordering.
 */
export function redriveDeadLetterQueue(): void {
  const dlq = getDeadLetterQueue();
  if (dlq.length === 0) return;
  const merged = [...getQueue(), ...dlq.map((op) => ({ ...op, retries: 0 }))].sort(
    (a, b) => a.seq - b.seq,
  );
  setQueue(merged);
  syncStorage.remove(DEAD_LETTER_KEY);
  void drainQueue();
}

export function clearDeadLetterQueue(): void {
  syncStorage.remove(DEAD_LETTER_KEY);
}

export function clearAll(): void {
  syncStorage.remove(QUEUE_KEY);
  syncStorage.remove(DEAD_LETTER_KEY);
  syncStorage.remove(SEQ_KEY);
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isNetworkError(error: unknown): boolean {
  if (error instanceof TypeError && error.message === 'Network request failed') return true;
  const msg = error instanceof Error ? error.message : String(error);
  return (
    msg.includes('Network request failed') ||
    msg.includes('Failed to fetch') ||
    msg.includes('internet connection appears to be offline') ||
    msg.includes('The request timed out') ||
    msg.includes('The network connection was lost')
  );
}

function isNotFoundError(error: unknown): boolean {
  const msg = error instanceof Error ? error.message : String(error);
  return msg.includes('"code":"NOT_FOUND"') || msg.includes('not found');
}
