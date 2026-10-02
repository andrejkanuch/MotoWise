jest.mock('react-native-mmkv', () => require('../../test/mocks').makeMmkvMock());

import { BIKE_SEGMENT } from '../../lib/bike-hub/constants';
import { resolveInitialSegment } from '../../lib/bike-hub/segments';
import { useBikeHubStore } from '../bike-hub.store';

describe('bike-hub store', () => {
  beforeEach(() => {
    useBikeHubStore.setState({ lastSegmentByBike: {} });
  });

  it('remembers the last segment per bike', () => {
    useBikeHubStore.getState().setLastSegment('bike-a', BIKE_SEGMENT.COSTS);
    useBikeHubStore.getState().setLastSegment('bike-b', BIKE_SEGMENT.BIKE);
    expect(useBikeHubStore.getState().lastSegmentByBike).toEqual({
      'bike-a': BIKE_SEGMENT.COSTS,
      'bike-b': BIKE_SEGMENT.BIKE,
    });
  });

  it('overwrites the segment of the same bike', () => {
    useBikeHubStore.getState().setLastSegment('bike-a', BIKE_SEGMENT.COSTS);
    useBikeHubStore.getState().setLastSegment('bike-a', BIKE_SEGMENT.SERVICE);
    expect(useBikeHubStore.getState().lastSegmentByBike['bike-a']).toBe(BIKE_SEGMENT.SERVICE);
  });

  it('forgets a removed bike and leaves the others', () => {
    useBikeHubStore.getState().setLastSegment('bike-a', BIKE_SEGMENT.COSTS);
    useBikeHubStore.getState().setLastSegment('bike-b', BIKE_SEGMENT.BIKE);
    useBikeHubStore.getState().forgetBike('bike-a');
    expect(useBikeHubStore.getState().lastSegmentByBike).toEqual({ 'bike-b': BIKE_SEGMENT.BIKE });
  });

  it('persists to MMKV under the store id', () => {
    useBikeHubStore.getState().setLastSegment('bike-a', BIKE_SEGMENT.SERVICE);
    const { __store } = jest.requireMock('react-native-mmkv') as { __store: Map<string, string> };
    expect(JSON.parse(__store.get('bike-hub') ?? '{}').state.lastSegmentByBike).toEqual({
      'bike-a': BIKE_SEGMENT.SERVICE,
    });
  });

  it('a task request is held until cleared and is never persisted', () => {
    useBikeHubStore.getState().requestTask('bike-a', 'task-1');
    expect(useBikeHubStore.getState().pendingTask).toEqual({ bikeId: 'bike-a', taskId: 'task-1' });
    const { __store } = jest.requireMock('react-native-mmkv') as { __store: Map<string, string> };
    expect(JSON.parse(__store.get('bike-hub') ?? '{}').state).not.toHaveProperty('pendingTask');
    useBikeHubStore.getState().clearPendingTask();
    expect(useBikeHubStore.getState().pendingTask).toBeNull();
  });

  it('a persisted segment this build does not know resolves to Overview', () => {
    useBikeHubStore.setState({
      lastSegmentByBike: { 'bike-a': 'insights' as never },
    });
    const remembered = useBikeHubStore.getState().lastSegmentByBike['bike-a'];
    expect(resolveInitialSegment({ remembered })).toBe(BIKE_SEGMENT.OVERVIEW);
  });
});
