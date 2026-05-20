import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no maintenance-task query/mutation is accidentally @Public().
 */
describe('MaintenanceTasksResolver auth guard audit', () => {
  const resolverPrototype = MaintenanceTasksResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = [
    'allMaintenanceTasks',
    'maintenanceTasks',
    'maintenanceTaskHistory',
    'createMaintenanceTask',
    'updateMaintenanceTask',
    'completeMaintenanceTask',
    'deleteMaintenanceTask',
    'spendingSummary',
    'addTaskPhoto',
    'deleteTaskPhoto',
  ];

  describe('all queries and mutations require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
