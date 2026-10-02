import { describe, expect, it } from 'vitest';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import { NotesResolver } from './notes.resolver';

/**
 * Guard audit: GqlAuthGuard is registered globally via APP_GUARD.
 * Verify that no note query/mutation is accidentally @Public().
 */
describe('NotesResolver auth guard audit', () => {
  const resolverPrototype = NotesResolver.prototype as unknown as Record<string, unknown>;

  const isPublic = (methodName: string) =>
    Reflect.getMetadata(IS_PUBLIC_KEY, resolverPrototype[methodName] as object) === true;

  const protectedMethods = [
    'notes',
    'createNote',
    'updateNote',
    'deleteNote',
    'createTaskFromNote',
    'addNotePhoto',
    'deleteNotePhoto',
    'photos',
  ];

  for (const method of protectedMethods) {
    it(`${method} should NOT be @Public()`, () => {
      expect(typeof resolverPrototype[method]).toBe('function');
      expect(isPublic(method)).toBe(false);
    });
  }
});
