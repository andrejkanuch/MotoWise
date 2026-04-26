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

function getDeadLetterQueue(): SyncOperation[] {
  const raw = syncStorage.getString(DEAD_LETTER_KEY);
  if (!raw) return [];
  return JSON.parse(raw) as SyncOperation[];
}

function moveToDeadLetter(op: SyncOperation): void {
  const dlq = getDeadLetterQueue();
  dlq.push(op);
  syncStorage.set(DEAD_LETTER_KEY, JSON.stringify(dlq));
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

export async function enqueueOrExecute(
  type: SyncOperationType,
  payload: Record<string, unknown>,
): Promise<void> {
  const networkState = await Network.getNetworkStateAsync();
  if (networkState.isConnected && networkState.isInternetReachable) {
    try {
      const document = MUTATION_DOCUMENT_MAP[type];
      const { variables } = payload as { variables: Record<string, unknown> };
      await gqlFetcher(document, variables as never);
      return;
    } catch (error) {
      // Network failures are expected (spotty cellular, backgrounded by iOS)
      // — the queue handles retry, so only report non-network errors to Sentry.
      if (!isNetworkError(error)) {
        captureException(error);
      }
      // Transient failure — fall through to queue
    }
  }
  enqueue(type, payload);
}

export async function drainQueue(): Promise<void> {
  const networkState = await Network.getNetworkStateAsync();
  if (!networkState.isConnected || !networkState.isInternetReachable) return;

  const queue = getQueue();
  if (queue.length === 0) return;

  const remaining: SyncOperation[] = [];

  for (const op of queue) {
    // Exponential backoff with jitter — only sleep on retries, not first attempt
    if (op.retries > 0) {
      const baseDelay = BASE_DELAY_MS * 2 ** op.retries;
      const jitteredDelay = baseDelay * (0.5 + Math.random() * 0.5);
      await sleep(jitteredDelay);
    }

    try {
      await executeSyncOperation(op);
    } catch (error) {
      captureException(error);
      op.retries++;
      if (op.retries >= MAX_RETRIES) {
        moveToDeadLetter(op);
      } else {
        remaining.push(op);
      }
    }
  }

  setQueue(remaining);
}

async function executeSyncOperation(op: SyncOperation): Promise<void> {
  // Resolve the GraphQL document from the operation type.
  // TypedDocumentNode objects don't serialize to JSON, so we look them up.
  // gqlFetcher handles JWT refresh automatically — safe for long rides.
  const document = MUTATION_DOCUMENT_MAP[op.type];
  if (!document) throw new Error(`Unknown sync operation type: ${op.type}`);

  const { variables } = op.payload as { variables: Record<string, unknown> };
  await gqlFetcher(document, variables as never);
}

export function getQueueLength(): number {
  return getQueue().length;
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
  return msg.includes('Network request failed') || msg.includes('Failed to fetch');
}
