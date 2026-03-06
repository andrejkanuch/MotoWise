import { expect } from 'vitest';
import { GqlAuthGuard } from '../../src/common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../src/common/pipes/zod-validation.pipe';

/**
 * Asserts that a resolver method has GqlAuthGuard applied via @UseGuards.
 */
export function expectGuarded(method: (...args: any[]) => any): void {
  const guards = Reflect.getMetadata('__guards__', method);
  expect(guards).toBeDefined();
  expect(guards.length).toBeGreaterThan(0);
  const hasAuthGuard = guards.some(
    (g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard',
  );
  expect(hasAuthGuard).toBe(true);
}

/**
 * Asserts that a resolver method does NOT have GqlAuthGuard (public endpoint).
 * Checks both method-level and class-level guards.
 */
export function expectNotGuarded(
  resolverClass: new (...args: any[]) => any,
  method: (...args: any[]) => any,
): void {
  const methodGuards = Reflect.getMetadata('__guards__', method);
  const classGuards = Reflect.getMetadata('__guards__', resolverClass);
  const allGuards = [...(methodGuards ?? []), ...(classGuards ?? [])];
  const hasAuthGuard = allGuards.some(
    (g: any) => g === GqlAuthGuard || g.name === 'GqlAuthGuard',
  );
  expect(hasAuthGuard).toBe(false);
}

/**
 * Asserts that a resolver method has ZodValidationPipe on one of its @Args.
 */
export function expectZodValidated(
  resolverClass: new (...args: any[]) => any,
  methodName: string,
): void {
  const params = Reflect.getMetadata('__routeArguments__', resolverClass, methodName);
  expect(params).toBeDefined();
  const paramValues = Object.values(params) as any[];
  const hasPipe = paramValues.some((p: any) =>
    p.pipes?.some((pipe: any) => pipe instanceof ZodValidationPipe),
  );
  expect(hasPipe).toBe(true);
}

/**
 * Asserts that a resolver method does NOT have ZodValidationPipe on its @Args.
 */
export function expectNotZodValidated(
  resolverClass: new (...args: any[]) => any,
  methodName: string,
): void {
  const params = Reflect.getMetadata('__routeArguments__', resolverClass, methodName);
  expect(params).toBeDefined();
  const paramValues = Object.values(params) as any[];
  const hasPipe = paramValues.some((p: any) =>
    p.pipes?.some((pipe: any) => pipe instanceof ZodValidationPipe),
  );
  expect(hasPipe).toBe(false);
}
