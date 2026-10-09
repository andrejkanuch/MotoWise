jest.mock('expo-localization', () => ({
  getLocales: () => [{ languageCode: 'en', languageTag: 'en-US' }],
}));
jest.mock('../../utils/haptics', () => ({
  triggerImpact: jest.fn(),
  triggerNotification: jest.fn(),
  triggerSelection: jest.fn(),
}));
jest.mock('../../lib/analytics', () => require('../../test/mocks').mockAnalytics());

const mockFetcher = jest.fn();
jest.mock('../../lib/graphql-client', () => ({
  gqlFetcher: (...args: unknown[]) => mockFetcher(...args),
}));

import {
  AcknowledgeRecallDocument,
  type MotorcycleRecallsQuery,
  type MyMotorcyclesQuery,
  UnacknowledgeRecallDocument,
} from '@motovault/graphql';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react-native';
import type { ReactNode } from 'react';
import { Alert } from 'react-native';
import '../../i18n';
import {
  RECALL_ACK_ACTION,
  type RecallItem,
  type RecallResultData,
  splitRecalls,
} from '../../lib/bike-hub/recall-acknowledgement';
import { queryKeys } from '../../lib/query-keys';
import { useRecallAcknowledgement } from '../use-recall-acknowledgement';

const BIKE_ID = 'bike-a';
const ACKED_AT = '2026-10-01T10:00:00.000Z';
const RECALLS_KEY = queryKeys.motorcycleRecalls.byMotorcycle(BIKE_ID);
const BIKES_KEY = queryKeys.motorcycles.all;
const A = '23V100000';
const B = '24V200000';

function recall(campaignNumber: string, ackAt: string | null = null): RecallItem {
  return {
    campaignNumber,
    component: `component ${campaignNumber}`,
    reportDate: '2024-01-01',
    summary: 'summary',
    consequence: 'consequence',
    remedy: 'remedy',
    acknowledged: ackAt !== null,
    acknowledgedAt: ackAt,
  };
}

function result(recalls: RecallItem[]): RecallResultData {
  const { open, done } = splitRecalls(recalls);
  return {
    count: open.length,
    acknowledgedCount: done.length,
    checkedAt: ACKED_AT,
    vinUsed: null,
    recalls: [...open, ...done],
  };
}

interface Deferred {
  document: unknown;
  campaignNumber: string;
  resolve: (value: unknown) => void;
  reject: (error: unknown) => void;
}

/** Every request waits until the test settles it, in whatever order it wants. */
let requests: Deferred[] = [];

function serverResult(document: unknown, data: RecallResultData) {
  return document === AcknowledgeRecallDocument
    ? { acknowledgeRecall: data }
    : { unacknowledgeRecall: data };
}

async function setup(initial: RecallResultData) {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false, gcTime: Infinity } },
  });
  // No observers here: keep the seeded caches from being collected.
  client.setQueryDefaults(RECALLS_KEY, { gcTime: Number.POSITIVE_INFINITY });
  client.setQueryDefaults(BIKES_KEY, { gcTime: Number.POSITIVE_INFINITY });
  client.setQueryData<MotorcycleRecallsQuery>(RECALLS_KEY, { motorcycleRecalls: initial });
  client.setQueryData<MyMotorcyclesQuery>(BIKES_KEY, {
    myMotorcycles: [{ id: BIKE_ID, recallCount: initial.count } as never],
  });
  const invalidate = jest.spyOn(client, 'invalidateQueries');
  const wrapper = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
  const hook = await renderHook(() => useRecallAcknowledgement(BIKE_ID), { wrapper });
  return { client, hook, invalidate };
}

const openCampaigns = (client: QueryClient) =>
  splitRecalls(
    client.getQueryData<MotorcycleRecallsQuery>(RECALLS_KEY)?.motorcycleRecalls.recalls ?? [],
  ).open.map((r) => r.campaignNumber);

const recallCount = (client: QueryClient) =>
  client.getQueryData<MyMotorcyclesQuery>(BIKES_KEY)?.myMotorcycles[0]?.recallCount;

const invalidatedKeys = (invalidate: jest.SpyInstance) =>
  invalidate.mock.calls.map(([filters]) => (filters as { queryKey: unknown }).queryKey);

/** Lets queued mutations start and TanStack's batched notifications land inside act. */
async function flush() {
  await act(async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
  });
}

let alert: jest.SpyInstance;

beforeEach(() => {
  requests = [];
  alert = jest.spyOn(Alert, 'alert').mockImplementation(() => {});
  mockFetcher.mockImplementation(
    (document: unknown, variables: { campaignNumber: string }) =>
      new Promise((resolve, reject) => {
        requests.push({ document, campaignNumber: variables.campaignNumber, resolve, reject });
      }),
  );
});

afterEach(async () => {
  // The refetch after the last ack settles, and TanStack's batched (setTimeout 0)
  // observer notifications, land after the assertions: flush them inside act.
  await flush();
  jest.restoreAllMocks();
  mockFetcher.mockReset();
});

describe('useRecallAcknowledgement — overlapping acks', () => {
  it('runs acks for one bike one at a time, keeping both optimistic changes', async () => {
    const { client, hook, invalidate } = await setup(result([recall(A), recall(B)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
      hook.result.current.mutate({ campaignNumber: B, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
    });

    // Both applied at once, but only A's request is out: B waits its turn.
    expect(openCampaigns(client)).toEqual([]);
    expect(recallCount(client)).toBe(0);
    expect(requests.map((r) => r.campaignNumber)).toEqual([A]);

    // A's result (B still open server-side) must not hide B's pending change.
    await act(async () => {
      requests[0]?.resolve(
        serverResult(AcknowledgeRecallDocument, result([recall(A, ACKED_AT), recall(B)])),
      );
    });
    await flush();
    expect(requests).toHaveLength(2);
    expect(openCampaigns(client)).toEqual([]);
    expect(recallCount(client)).toBe(0);
    expect(invalidatedKeys(invalidate)).not.toContainEqual(RECALLS_KEY);

    await act(async () => {
      requests[1]?.resolve(
        serverResult(AcknowledgeRecallDocument, result([recall(A, ACKED_AT), recall(B, ACKED_AT)])),
      );
    });
    await flush();
    expect(invalidatedKeys(invalidate)).toContainEqual(RECALLS_KEY);
    expect(invalidatedKeys(invalidate)).toContainEqual(BIKES_KEY);
    expect(openCampaigns(client)).toEqual([]);
    expect(recallCount(client)).toBe(0);
  });

  it('when A fails after B applied, B stays acknowledged and both caches are refetched', async () => {
    const { client, hook, invalidate } = await setup(result([recall(A), recall(B)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
      hook.result.current.mutate({ campaignNumber: B, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
    });
    await act(async () => {
      requests[0]?.reject(new Error('network'));
    });

    // A's snapshot (both open) is not restored over B's optimistic ack.
    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(openCampaigns(client)).not.toContain(B);
    expect(invalidatedKeys(invalidate)).not.toContainEqual(RECALLS_KEY);

    // B goes out after A settled; its result is the server truth (A still open).
    await flush();
    expect(requests).toHaveLength(2);
    await act(async () => {
      requests[1]?.resolve(
        serverResult(AcknowledgeRecallDocument, result([recall(A), recall(B, ACKED_AT)])),
      );
    });
    await flush();
    expect(invalidatedKeys(invalidate)).toContainEqual(RECALLS_KEY);
    expect(openCampaigns(client)).toEqual([A]);
    expect(recallCount(client)).toBe(1);
  });

  it('when B fails after A succeeded, only B is rolled back', async () => {
    const { client, hook } = await setup(result([recall(A), recall(B)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
      hook.result.current.mutate({ campaignNumber: B, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
    });
    await act(async () => {
      requests[0]?.resolve(
        serverResult(AcknowledgeRecallDocument, result([recall(A, ACKED_AT), recall(B)])),
      );
    });
    await flush();
    expect(requests).toHaveLength(2);
    await act(async () => {
      requests[1]?.reject(new Error('network'));
    });

    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
    expect(openCampaigns(client)).toEqual([B]);
    expect(recallCount(client)).toBe(1);
  });

  it('mark-then-undo on one campaign ends open, in request order', async () => {
    const { client, hook } = await setup(result([recall(A)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.UNACKNOWLEDGE });
    });
    expect(openCampaigns(client)).toEqual([A]);
    expect(requests.map((r) => r.document)).toEqual([AcknowledgeRecallDocument]);

    await act(async () => {
      requests[0]?.resolve(serverResult(AcknowledgeRecallDocument, result([recall(A, ACKED_AT)])));
    });
    // The ack's result must not flash A as done while the undo is pending.
    expect(openCampaigns(client)).toEqual([A]);
    await flush();
    expect(requests).toHaveLength(2);
    expect(requests[1]?.document).toBe(UnacknowledgeRecallDocument);

    await act(async () => {
      requests[1]?.resolve(serverResult(UnacknowledgeRecallDocument, result([recall(A)])));
    });
    await flush();
    expect(openCampaigns(client)).toEqual([A]);
    expect(recallCount(client)).toBe(1);
  });
});

describe('useRecallAcknowledgement — rollback', () => {
  it('a failed undo restores the recall as done and alerts', async () => {
    const { client, hook } = await setup(result([recall(A, ACKED_AT)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.UNACKNOWLEDGE });
    });
    expect(openCampaigns(client)).toEqual([A]);
    expect(recallCount(client)).toBe(1);

    await act(async () => {
      requests[0]?.reject(new Error('network'));
    });
    await flush();
    expect(alert).toHaveBeenCalledWith('Error', "Couldn't update this recall. Please try again.");
    expect(openCampaigns(client)).toEqual([]);
    const restored = client.getQueryData<MotorcycleRecallsQuery>(RECALLS_KEY)?.motorcycleRecalls;
    expect(restored?.recalls[0]?.acknowledgedAt).toBe(ACKED_AT);
  });

  it('a failed ack restores the garage recallCount', async () => {
    const { client, hook, invalidate } = await setup(result([recall(A), recall(B)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
    });
    expect(recallCount(client)).toBe(1);

    await act(async () => {
      requests[0]?.reject(new Error('network'));
    });
    await flush();
    expect(recallCount(client)).toBe(2);
    await flush();
    expect(invalidatedKeys(invalidate)).toContainEqual(BIKES_KEY);
    expect(invalidatedKeys(invalidate)).toContainEqual(RECALLS_KEY);
  });

  it('still alerts when the screen unmounted before the request failed', async () => {
    const { hook } = await setup(result([recall(A)]));

    await act(async () => {
      hook.result.current.mutate({ campaignNumber: A, action: RECALL_ACK_ACTION.ACKNOWLEDGE });
    });
    await hook.unmount();
    await act(async () => {
      requests[0]?.reject(new Error('network'));
    });

    await flush();
    expect(alert).toHaveBeenCalledTimes(1);
  });
});
