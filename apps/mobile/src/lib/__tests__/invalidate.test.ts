// Each helper invalidates exactly the keys its call sites invalidated before
// they were folded into it — pinned as the literal cache keys, so a drift in a
// key builder or a dropped line fails here instead of leaving a list stale.
import { QueryClient, QueryObserver } from '@tanstack/react-query';
import {
  invalidateDocuments,
  invalidateMaintenanceTasks,
  invalidateTrips,
  invalidateUser,
} from '../invalidate';

function spyInvalidations(client: QueryClient) {
  const spy = jest.spyOn(client, 'invalidateQueries');
  return () => spy.mock.calls.map(([filters]) => filters?.queryKey);
}

describe('invalidateMaintenanceTasks', () => {
  it('with a bike id refreshes the task list of that bike and the all-user list, nothing else', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateMaintenanceTasks(client, 'bike-1');
    expect(invalidated()).toEqual([
      ['maintenance-tasks', 'motorcycle', 'bike-1'],
      ['maintenance-tasks', 'all-user'],
    ]);
  });

  it('without a bike id refreshes only the all-user list', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateMaintenanceTasks(client);
    expect(invalidated()).toEqual([['maintenance-tasks', 'all-user']]);
  });
});

describe('invalidateTrips', () => {
  it('without a trip id refreshes the trips prefix, nothing else', async () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    await invalidateTrips(client);
    expect(invalidated()).toEqual([['trips']]);
  });

  it('with a trip id refreshes the trips prefix and that trip, nothing else', async () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    await invalidateTrips(client, 'trip-1');
    expect(invalidated()).toEqual([['trips'], ['trips', 'detail', 'trip-1']]);
  });

  it('settles when the detail refetch does, so an editor can close on fresh data', async () => {
    const client = new QueryClient();
    const resolvers: Array<(value: string) => void> = [];
    const observer = new QueryObserver(client, {
      queryKey: ['trips', 'detail', 'trip-1'],
      queryFn: () => new Promise<string>((resolve) => resolvers.push(resolve)),
    });
    const unsubscribe = observer.subscribe(() => {});
    await new Promise((tick) => setImmediate(tick));
    resolvers[0]('as saved before');
    await new Promise((tick) => setImmediate(tick));

    let settled = false;
    const done = invalidateTrips(client, 'trip-1').then(() => {
      settled = true;
    });
    await new Promise((tick) => setImmediate(tick));
    // The prefix invalidation refetches the active detail too; the detail
    // invalidation then restarts it, and the helper waits for that last fetch.
    expect(resolvers.length).toBeGreaterThan(1);
    expect(settled).toBe(false);

    resolvers[resolvers.length - 1]('as saved now');
    await done;
    expect(settled).toBe(true);
    expect(client.getQueryData(['trips', 'detail', 'trip-1'])).toBe('as saved now');
    unsubscribe();
  });

  it('marks my trips, drafts and the home list stale, and leaves the editor copy alone', () => {
    const client = new QueryClient();
    const listKeys = [
      ['trips', 'my'],
      ['trips', 'myDrafts'],
      ['trips', 'list', 'home'],
    ];
    const editorKey = ['trip-edit', 'trip-1'];
    for (const key of [...listKeys, editorKey]) client.setQueryData(key, { cached: true });

    void invalidateTrips(client, 'trip-1');

    for (const key of listKeys) expect(client.getQueryState(key)?.isInvalidated).toBe(true);
    expect(client.getQueryState(editorKey)?.isInvalidated).toBe(false);
  });
});

describe('invalidateDocuments', () => {
  it('refreshes the documents of that bike and the expiring list, nothing else', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateDocuments(client, 'bike-1');
    expect(invalidated()).toEqual([
      ['documents', 'byMotorcycle', 'bike-1'],
      ['documents', 'expiring'],
    ]);
  });
});

describe('invalidateUser', () => {
  it('with bikes refreshes the user and the bike list, nothing else', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateUser(client, { withBikes: true });
    expect(invalidated()).toEqual([['user', 'me'], ['motorcycles']]);
  });

  it('without bikes refreshes only the user', () => {
    const client = new QueryClient();
    const invalidated = spyInvalidations(client);
    invalidateUser(client, { withBikes: false });
    expect(invalidated()).toEqual([['user', 'me']]);
  });
});
