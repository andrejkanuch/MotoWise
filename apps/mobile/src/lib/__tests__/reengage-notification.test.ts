// MOT-275: scheduleReEngageNotification must (a) no-op without permission, (b) no-op
// when the shared iOS budget is exhausted (so reminder_scheduled is never fired for
// a phantom notification), (c) tag the payload with kind:re_engage and persist the id,
// and (d) cancel cleanly. These guard the analytics accuracy + cancel-on-return contract.

const mockGetPermissions = jest.fn();
const mockGetAllScheduled = jest.fn();
const mockSchedule = jest.fn();
const mockCancel = jest.fn();
const mockStore = new Map<string, string>();

jest.mock('expo-notifications', () => ({
  getPermissionsAsync: () => mockGetPermissions(),
  getAllScheduledNotificationsAsync: () => mockGetAllScheduled(),
  scheduleNotificationAsync: (req: unknown) => mockSchedule(req),
  cancelScheduledNotificationAsync: (id: string) => mockCancel(id),
  SchedulableTriggerInputTypes: { DATE: 'date' },
}));

jest.mock('@react-native-async-storage/async-storage', () => ({
  getItem: (k: string) => Promise.resolve(mockStore.has(k) ? mockStore.get(k) : null),
  setItem: (k: string, v: string) => {
    mockStore.set(k, v);
    return Promise.resolve();
  },
  removeItem: (k: string) => {
    mockStore.delete(k);
    return Promise.resolve();
  },
}));

import {
  cancelReEngageNotification,
  NOTIFICATION_KIND,
  scheduleReEngageNotification,
} from '../notifications';

const COPY = { title: 'Your garage is waiting', body: 'Come back and set up your bike.' };

beforeEach(() => {
  jest.clearAllMocks();
  mockStore.clear();
  mockGetAllScheduled.mockResolvedValue([]);
  mockSchedule.mockResolvedValue('reengage-id-1');
});

describe('scheduleReEngageNotification', () => {
  it('no-ops and returns false when permission is not granted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'denied' });
    const result = await scheduleReEngageNotification(COPY);
    expect(result).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('schedules a re_engage notification and persists its id when granted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    const result = await scheduleReEngageNotification(COPY);

    expect(result).toBe(true);
    expect(mockSchedule).toHaveBeenCalledTimes(1);
    const req = mockSchedule.mock.calls[0][0];
    expect(req.content.data.kind).toBe(NOTIFICATION_KIND.RE_ENGAGE);
    expect(req.content.title).toBe(COPY.title);
  });

  it('no-ops and returns false when the iOS budget is exhausted', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    mockGetAllScheduled.mockResolvedValue(new Array(60).fill({}));
    const result = await scheduleReEngageNotification(COPY);
    expect(result).toBe(false);
    expect(mockSchedule).not.toHaveBeenCalled();
  });

  it('cancels any previously-scheduled re-engagement before scheduling a new one', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    await scheduleReEngageNotification(COPY); // first → stores id
    await scheduleReEngageNotification(COPY); // second → should cancel the first
    expect(mockCancel).toHaveBeenCalledWith('reengage-id-1');
  });
});

describe('cancelReEngageNotification', () => {
  it('cancels and clears the stored notification id', async () => {
    mockGetPermissions.mockResolvedValue({ status: 'granted' });
    await scheduleReEngageNotification(COPY);

    await cancelReEngageNotification();
    expect(mockCancel).toHaveBeenCalledWith('reengage-id-1');

    // second cancel is a no-op (id already cleared)
    mockCancel.mockClear();
    await cancelReEngageNotification();
    expect(mockCancel).not.toHaveBeenCalled();
  });
});
