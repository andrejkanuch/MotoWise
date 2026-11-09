import { BadRequestException } from '@nestjs/common';
import { ROUTE_ARGS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import type { Ride } from './models/ride.model';
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
    'pauseRide',
    'resumeRide',
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

describe('RidesResolver pause / resume', () => {
  it('passes the rider and ride to the service, paused or not', async () => {
    const calls: unknown[][] = [];
    const service = {
      setRidePaused: async (...args: unknown[]) => {
        calls.push(args);
        return true;
      },
    };
    const resolver = new RidesResolver(service as never);
    const user = { id: 'user-1' } as never;
    await expect(resolver.pauseRide(user, { rideId: 'r1' })).resolves.toBe(true);
    await expect(resolver.resumeRide(user, { rideId: 'r1' })).resolves.toBe(true);
    expect(calls).toEqual([
      ['user-1', 'r1', true],
      ['user-1', 'r1', false],
    ]);
  });
});

describe('RidesResolver owner-only ride fields', () => {
  const publicRide = {
    id: 'ride-1',
    userId: 'owner-1',
    region: 'Tirol',
    timeZone: 'Europe/Vienna',
    endSource: 'rider_phone',
    purpose: 'tour',
    passenger: true,
  } as Ride;
  const service = { getPublicRide: async () => publicRide };
  const resolver = new RidesResolver(service as never);
  const ownerOnlyFields = (ride: Ride, user?: AuthUser) => ({
    region: resolver.region(ride, user),
    timeZone: resolver.timeZone(ride, user),
    endSource: resolver.endSource(ride, user),
    purpose: resolver.purpose(ride, user),
    passenger: resolver.passenger(ride, user),
  });
  const allNull = { region: null, timeZone: null, endSource: null, purpose: null, passenger: null };

  it('getPublicRide returns null place and recording fields to an anonymous viewer', async () => {
    const ride = await resolver.getPublicRide('ride-1');
    expect(ownerOnlyFields(ride, undefined)).toEqual(allNull);
  });

  it('getPublicRide returns null place and recording fields to another signed-in rider', async () => {
    const ride = await resolver.getPublicRide('ride-1');
    expect(ownerOnlyFields(ride, { id: 'someone-else' } as AuthUser)).toEqual(allNull);
  });

  it('the owner sees their own values', async () => {
    const ride = await resolver.getPublicRide('ride-1');
    expect(ownerOnlyFields(ride, { id: 'owner-1' } as AuthUser)).toEqual({
      region: 'Tirol',
      timeZone: 'Europe/Vienna',
      endSource: 'rider_phone',
      purpose: 'tour',
      passenger: true,
    });
  });
});
