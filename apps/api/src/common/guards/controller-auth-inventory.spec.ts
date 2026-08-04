import 'reflect-metadata';
import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { GUARDS_METADATA } from '@nestjs/common/constants';
import { describe, expect, it } from 'vitest';
import { HealthController } from '../../modules/health/health.controller';
import { MaintenanceDuePushController } from '../../modules/push-tokens/maintenance-due-push.controller';
import { RideIdleCheckController } from '../../modules/push-tokens/ride-idle-check.controller';
import { RevenueCatWebhookController } from '../../modules/webhooks/revenuecat.controller';
import { IS_PUBLIC_KEY } from '../decorators/public.decorator';

/**
 * Controller auth inventory (audit guard, Phase 1a).
 *
 * `GqlAuthGuard` is registered globally via `APP_GUARD` and branches on transport:
 * GraphQL routes use the JWT, REST routes are enforced-closed UNLESS `@Public()`.
 * The real risk introduced by the default-closed guard is the inverse: a NEW
 * `@Public()` REST controller that silently bypasses auth with no replacement
 * authentication of its own.
 *
 * This spec pins the CURRENT REST controller surface: both must be explicitly
 * `@Public()`, and the only `@Public()` controller that mutates state — the
 * RevenueCat webhook — must carry its own HMAC authentication. A teammate adding
 * a new controller has to update this list, which is the moment to ask whether
 * the route should be authenticated.
 */
describe('REST controller auth inventory', () => {
  // Every @Controller class that exists in apps/api. A fully-dynamic scan over the
  // Nest container is brittle in a unit test, so we enumerate explicitly — the
  // source-tree assertion below fails the build if a new @Controller appears and
  // is not added here.
  const KNOWN_CONTROLLERS = [
    HealthController,
    RevenueCatWebhookController,
    MaintenanceDuePushController,
    RideIdleCheckController,
  ] as const;

  const isClassPublic = (cls: object) => Reflect.getMetadata(IS_PUBLIC_KEY, cls) === true;

  const hasOwnGuard = (cls: { prototype: object }) => {
    if (Reflect.getMetadata(GUARDS_METADATA, cls)) return true;
    const proto = cls.prototype;
    return Object.getOwnPropertyNames(proto).some(
      (m) => m !== 'constructor' && Reflect.getMetadata(GUARDS_METADATA, (proto as never)[m]),
    );
  };

  for (const Controller of KNOWN_CONTROLLERS) {
    it(`${Controller.name} is either @Public() or carries its own guard`, () => {
      expect(isClassPublic(Controller) || hasOwnGuard(Controller)).toBe(true);
    });
  }

  it('HealthController is explicitly @Public()', () => {
    expect(isClassPublic(HealthController)).toBe(true);
  });

  it('RevenueCatWebhookController is explicitly @Public()', () => {
    expect(isClassPublic(RevenueCatWebhookController)).toBe(true);
  });

  it('MaintenanceDuePushController is explicitly @Public()', () => {
    expect(isClassPublic(MaintenanceDuePushController)).toBe(true);
  });

  it('maintenance-due-push performs its own secret-header authentication (the real auth behind @Public)', () => {
    // @Public() removes the JWT guard, so the timing-safe secret comparison IS the auth.
    // Pin that the handler still compares the header against the configured secret and
    // rejects when either is missing (fails closed).
    const src = readFileSync(
      join(__dirname, '../../modules/push-tokens/maintenance-due-push.controller.ts'),
      'utf8',
    );
    expect(src).toContain('timingSafeEqual');
    expect(src).toContain('MAINTENANCE_PUSH_SECRET');
    expect(src).toContain('UnauthorizedException');
    // Fails closed: rejects when the secret env or the secret header is absent.
    expect(src).toMatch(/!secret\s*\|\|\s*!secretHeader/);
  });

  it('RideIdleCheckController is explicitly @Public()', () => {
    expect(isClassPublic(RideIdleCheckController)).toBe(true);
  });

  it('ride-idle-check performs its own secret-header authentication (the real auth behind @Public)', () => {
    // This endpoint MUTATES rider data (it can end a ride), so the secret comparison
    // being the only auth makes it the highest-risk @Public() route after the
    // RevenueCat webhook. Pin that it still fails closed.
    const src = readFileSync(
      join(__dirname, '../../modules/push-tokens/ride-idle-check.controller.ts'),
      'utf8',
    );
    expect(src).toContain('timingSafeEqual');
    expect(src).toContain('RIDE_IDLE_SECRET');
    expect(src).toContain('UnauthorizedException');
    // Fails closed: rejects when the secret env or the secret header is absent.
    expect(src).toMatch(/!secret\s*\|\|\s*!secretHeader/);
    // Takes no request body: thresholds are service constants, so a leaked secret
    // cannot be used to end rides earlier than the configured 24h.
    expect(src).not.toContain('@Body');
  });

  it('RevenueCat webhook performs its own HMAC authentication (the real auth behind @Public)', () => {
    // @Public() removes the JWT guard, so the HMAC comparison IS the auth. Pin that
    // the handler still timing-safe-compares the bearer token against the configured
    // secret and rejects when either is missing (fails closed).
    const src = readFileSync(
      join(__dirname, '../../modules/webhooks/revenuecat.controller.ts'),
      'utf8',
    );
    expect(src).toContain('timingSafeEqual');
    expect(src).toContain('REVENUECAT_WEBHOOK_SECRET');
    expect(src).toContain('UnauthorizedException');
    // Fails closed: rejects when the secret env or the auth header is absent.
    expect(src).toMatch(/!secret\s*\|\|\s*!normalizedAuth/);
  });

  it('no un-enumerated @Controller exists in apps/api (forces this inventory to stay current)', () => {
    // Static guard: grep the source tree for @Controller and assert the count matches
    // the explicitly-enumerated list above. A new controller fails this test until a
    // human decides whether it needs auth and adds it to KNOWN_CONTROLLERS.
    const srcRoot = join(__dirname, '../..');
    const out = execSync(
      `grep -rl "@Controller" "${srcRoot}" --include="*.ts" --exclude="*.spec.ts"`,
      { encoding: 'utf8' },
    ).trim();
    const files = out ? out.split('\n').filter(Boolean) : [];
    expect(files).toHaveLength(KNOWN_CONTROLLERS.length);
  });
});
