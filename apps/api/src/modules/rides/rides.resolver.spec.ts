import { BadRequestException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { RidesResolver } from './rides.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no ride query/mutation is accidentally @Public()
 * (except getPublicRide which is intentionally public).
 */
describe('RidesResolver auth guard audit', () => {
  const resolverPrototype = RidesResolver.prototype;

  const isPublic = (methodName: string) => {
    return Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName]) === true;
  };

  const protectedMethods = [
    'startRide',
    'endRide',
    'uploadWaypoints',
    'updateRide',
    'deleteRide',
    'myRides',
    'ride',
    'rideMilestoneStats',
  ];

  describe('all protected queries and mutations require authentication (not @Public())', () => {
    for (const method of protectedMethods) {
      it(`${method} should NOT be @Public()`, () => {
        expect(isPublic(method)).toBe(false);
      });
    }
  });

  describe('public queries', () => {
    it('getPublicRide should be @Public()', () => {
      expect(isPublic('getPublicRide')).toBe(true);
    });
  });
});

/**
 * Every ride id argument in this resolver goes through ParseUUIDPipe so a
 * malformed id is a 400 at the boundary, not a Postgres uuid-cast 500 from the
 * service. `excludeRideId` is nullable; the pipe passes null/undefined through.
 */
describe('RidesResolver rideMilestoneStats argument validation', () => {
  type RouteArg = { index: number; data?: unknown; pipes: unknown[] };
  const routeArgs = Reflect.getMetadata(
    ROUTE_ARGS_METADATA,
    RidesResolver,
    'rideMilestoneStats',
  ) as Record<string, RouteArg>;
  const excludeRideIdArg = Object.values(routeArgs).find((arg) => arg.data === 'excludeRideId');

  it('binds ParseUUIDPipe to excludeRideId', () => {
    expect(excludeRideIdArg).toBeDefined();
    expect(excludeRideIdArg?.pipes).toContain(ParseUUIDPipe);
  });

  it('rejects a non-UUID excludeRideId with BadRequestException and lets an omitted one through', () => {
    const metadata = { type: 'custom' as const, data: 'excludeRideId' };
    expect(() => ParseUUIDPipe.transform('not-a-uuid', metadata)).toThrow(BadRequestException);
    expect(ParseUUIDPipe.transform(undefined, metadata)).toBeUndefined();
    expect(ParseUUIDPipe.transform(null, metadata)).toBeNull();
  });
});
