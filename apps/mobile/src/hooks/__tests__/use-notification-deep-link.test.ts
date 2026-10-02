jest.mock('expo-notifications', () => ({}));
jest.mock('expo-router', () => ({ useRouter: jest.fn(), useSegments: jest.fn() }));
jest.mock('../../stores/auth.store', () => ({ useAuthStore: jest.fn() }));

import { extractRoute } from '../use-notification-deep-link';

const BIKE = '8ab2c94c-8e31-5f67-a317-a05653541ff0';
const TASK = '1e4a51e5-6ba9-5270-be61-aee4b0df7a34';

describe('notification deep link → bike hub', () => {
  it('a maintenance reminder (motorcycleId + taskId) lands on the task: Service, not the remembered segment', () => {
    expect(extractRoute({ motorcycleId: BIKE, taskId: TASK, stage: '7d' })).toEqual({
      pathname: '/(tabs)/(garage)/bike/[id]',
      params: { id: BIKE, highlightTask: TASK },
    });
  });

  it('a notification with only the bike lands by the default rule', () => {
    expect(extractRoute({ motorcycleId: BIKE })).toBe(`/(tabs)/(garage)/bike/${BIKE}`);
  });

  it('ignores a taskId that is not a UUID instead of passing it into the route', () => {
    expect(extractRoute({ motorcycleId: BIKE, taskId: '../../settings' })).toBe(
      `/(tabs)/(garage)/bike/${BIKE}`,
    );
  });

  it('rejects a payload without a valid bike id', () => {
    expect(extractRoute({ motorcycleId: 'not-a-uuid', taskId: TASK })).toBeNull();
    expect(extractRoute(undefined)).toBeNull();
  });
});
