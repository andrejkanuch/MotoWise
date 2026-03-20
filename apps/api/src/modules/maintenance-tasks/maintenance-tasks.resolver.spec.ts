import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { MaintenanceTasksResolver } from './maintenance-tasks.resolver';

/**
 * Guard audit: verify that all maintenance-task query/mutation handlers
 * have GqlAuthGuard and none are accidentally @Public().
 */
describe('MaintenanceTasksResolver auth guard audit', () => {
  const resolverPrototype = MaintenanceTasksResolver.prototype;

  const getGuards = (methodName: string) => {
    const guards = Reflect.getMetadata('__guards__', resolverPrototype[methodName]) ?? [];
    return guards;
  };

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

  describe('all queries and mutations require authentication', () => {
    for (const method of protectedMethods) {
      it(`${method} should have GqlAuthGuard`, () => {
        const guards = getGuards(method);
        expect(guards).toContain(GqlAuthGuard);
      });

      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });
});
