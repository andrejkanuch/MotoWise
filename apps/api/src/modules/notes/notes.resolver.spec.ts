import { NOTE_PHOTOS_MAX } from '@motovault/types';
import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { IS_PUBLIC_KEY } from '../../common/decorators/public.decorator';
import type { Note } from './models/note.model';
import type { NotePhoto } from './models/note-photo.model';
import type { NotePhotosLoader } from './note-photos.loader';
import { NotesResolver } from './notes.resolver';
import { NotesService } from './notes.service';

const USER: AuthUser = { id: 'user-1', email: 'rider@example.com', role: 'user', tier: 'free' };
const NOTE_ID = 'note-1';
const BIKE_ID = 'bike-1';
const TASK_ID = 'task-1';
const PHOTO_ID = 'photo-1';
const SUPABASE_URL = 'https://example.supabase.co';
const NOTE_TEXT =
  'Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.';

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

describe('NotesResolver — delegates to the service as the signed-in rider', () => {
  const note: Note = {
    id: NOTE_ID,
    motorcycleId: BIKE_ID,
    text: NOTE_TEXT,
    odometer: 38100,
    createdAt: '2026-09-28T10:00:00Z',
    updatedAt: '2026-09-28T10:00:00Z',
  } as Note;
  const photo: NotePhoto = {
    id: PHOTO_ID,
    noteId: NOTE_ID,
    storagePath: `${USER.id}/notes/${NOTE_ID}/1.webp`,
    publicUrl: `${SUPABASE_URL}/storage/v1/object/public/maintenance-photos/x.webp`,
    mimeType: 'image/webp',
    createdAt: '2026-09-28T10:00:00Z',
  } as NotePhoto;

  const service = {
    findByMotorcycle: vi.fn(),
    create: vi.fn(),
    update: vi.fn(),
    softDelete: vi.fn(),
    createTaskFromNote: vi.fn(),
    addPhoto: vi.fn(),
    deletePhoto: vi.fn(),
  };
  const loader = { load: vi.fn() };
  let resolver: NotesResolver;

  beforeEach(() => {
    vi.clearAllMocks();
    resolver = new NotesResolver(
      service as unknown as NotesService,
      loader as unknown as NotePhotosLoader,
    );
  });

  it('notes: lists the bike’s notes for the caller and returns them as the service ordered them', async () => {
    // Arrange
    const older = { ...note, id: 'note-0' };
    service.findByMotorcycle.mockResolvedValueOnce([note, older]);

    // Act
    const result = await resolver.notes(USER, BIKE_ID);

    // Assert
    expect(service.findByMotorcycle).toHaveBeenCalledWith(USER.id, BIKE_ID);
    expect(result).toEqual([note, older]);
  });

  it('createNote: passes the validated input through, including alsoCreateTask', async () => {
    const input = { motorcycleId: BIKE_ID, text: NOTE_TEXT, odometer: 38100, alsoCreateTask: true };
    service.create.mockResolvedValueOnce({ ...note, linkedTaskId: TASK_ID });

    const result = await resolver.createNote(USER, input);

    expect(service.create).toHaveBeenCalledWith(USER.id, input);
    expect(result.linkedTaskId).toBe(TASK_ID);
  });

  it('updateNote: sends the id and the input, null odometer included', async () => {
    const input = { odometer: null };
    service.update.mockResolvedValueOnce({ ...note, odometer: undefined });

    await resolver.updateNote(USER, NOTE_ID, input);

    expect(service.update).toHaveBeenCalledWith(USER.id, NOTE_ID, input);
  });

  it('deleteNote: returns true for a deleted note', async () => {
    service.softDelete.mockResolvedValueOnce(true);

    await expect(resolver.deleteNote(USER, NOTE_ID)).resolves.toBe(true);
    expect(service.softDelete).toHaveBeenCalledWith(USER.id, NOTE_ID);
  });

  it('deleteNote: lets NotFound through instead of answering false', async () => {
    service.softDelete.mockRejectedValueOnce(new NotFoundException('Note not found'));

    await expect(resolver.deleteNote(USER, NOTE_ID)).rejects.toThrow(NotFoundException);
  });

  it('createTaskFromNote: asks for the caller’s note', async () => {
    service.createTaskFromNote.mockResolvedValueOnce({ ...note, linkedTaskId: TASK_ID });

    const result = await resolver.createTaskFromNote(USER, NOTE_ID);

    expect(service.createTaskFromNote).toHaveBeenCalledWith(USER.id, NOTE_ID);
    expect(result.linkedTaskId).toBe(TASK_ID);
  });

  it('addNotePhoto: unpacks the input in the order the service expects', async () => {
    service.addPhoto.mockResolvedValueOnce(photo);
    const input = { noteId: NOTE_ID, storagePath: photo.storagePath, fileSizeBytes: 204800 };

    const result = await resolver.addNotePhoto(USER, input);

    expect(service.addPhoto).toHaveBeenCalledWith(USER.id, NOTE_ID, photo.storagePath, 204800);
    expect(result).toBe(photo);
  });

  it('addNotePhoto: the owner is the token’s user, never something in the input', async () => {
    service.addPhoto.mockResolvedValueOnce(photo);
    const forged = {
      noteId: NOTE_ID,
      storagePath: `user-2/notes/${NOTE_ID}/1.webp`,
      userId: 'user-2',
    };

    await resolver.addNotePhoto(USER, forged);

    expect(service.addPhoto.mock.calls[0]?.[0]).toBe(USER.id);
  });

  it('deleteNotePhoto: deletes by photo id for the caller', async () => {
    service.deletePhoto.mockResolvedValueOnce(true);

    await expect(resolver.deleteNotePhoto(USER, PHOTO_ID)).resolves.toBe(true);
    expect(service.deletePhoto).toHaveBeenCalledWith(USER.id, PHOTO_ID);
  });

  it('photos: resolves through the request-scoped loader, not the service', async () => {
    loader.load.mockResolvedValueOnce([photo]);

    await expect(resolver.photos(note)).resolves.toEqual([photo]);
    expect(loader.load).toHaveBeenCalledWith(NOTE_ID);
  });

  it.each([
    ['notes', () => resolver.notes(USER, BIKE_ID), 'findByMotorcycle'],
    ['createNote', () => resolver.createNote(USER, { motorcycleId: BIKE_ID, text: 'x' }), 'create'],
    ['updateNote', () => resolver.updateNote(USER, NOTE_ID, { text: 'x' }), 'update'],
    ['createTaskFromNote', () => resolver.createTaskFromNote(USER, NOTE_ID), 'createTaskFromNote'],
    ['deleteNotePhoto', () => resolver.deleteNotePhoto(USER, PHOTO_ID), 'deletePhoto'],
  ] as const)('%s: a service error reaches the client unchanged', async (_name, call, method) => {
    const failure = new ForbiddenException('You do not have access to this motorcycle or note');
    service[method].mockRejectedValueOnce(failure);

    await expect(call()).rejects.toBe(failure);
  });
});

/** Chainable Supabase mock: every builder method returns the chain. */
function createSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'order']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  return { from: vi.fn().mockReturnValue(chain), chain, rpc: vi.fn() };
}

const noteRow = (overrides: Record<string, unknown> = {}) => ({
  id: NOTE_ID,
  user_id: USER.id,
  motorcycle_id: BIKE_ID,
  body: NOTE_TEXT,
  odometer: 38100,
  linked_task_id: null,
  linked_expense_id: null,
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
  linked_task: null,
  linked_expense: null,
  ...overrides,
});

describe('NotesResolver — through the real service', () => {
  let resolver: NotesResolver;
  let db: ReturnType<typeof createSupabaseMock>;
  let tasksService: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    db = createSupabaseMock();
    tasksService = { create: vi.fn().mockResolvedValue({ id: TASK_ID }) };
    const service = new NotesService(
      db as never,
      createSupabaseMock() as never,
      { getOrThrow: vi.fn().mockReturnValue(SUPABASE_URL) } as never,
      tasksService as never,
    );
    const quiet = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
    Object.assign(service, { logger: quiet });
    resolver = new NotesResolver(service, { load: vi.fn() } as unknown as NotePhotosLoader);
  });

  describe('createNote with alsoCreateTask', () => {
    const input = { motorcycleId: BIKE_ID, text: NOTE_TEXT, alsoCreateTask: true };

    it('returns the saved note, unlinked, when the task cannot be created', async () => {
      // Arrange
      db.chain.single.mockResolvedValueOnce({ data: noteRow(), error: null });
      tasksService.create.mockRejectedValueOnce(new BadRequestException('task rejected'));

      // Act
      const note = await resolver.createNote(USER, input);

      // Assert
      expect(note).toMatchObject({ id: NOTE_ID, text: NOTE_TEXT, motorcycleId: BIKE_ID });
      expect(note.linkedTaskId).toBeUndefined();
      expect(note.linkedTaskTitle).toBeUndefined();
    });

    it('does not write a link when the task was not created', async () => {
      db.chain.single.mockResolvedValueOnce({ data: noteRow(), error: null });
      tasksService.create.mockRejectedValueOnce(new Error('database unavailable'));

      await resolver.createNote(USER, input);

      expect(db.chain.insert).toHaveBeenCalledTimes(1);
      expect(db.chain.update).not.toHaveBeenCalled();
    });

    it('returns the saved note, unlinked, when the task exists but the link cannot be stored', async () => {
      db.chain.single
        .mockResolvedValueOnce({ data: noteRow(), error: null })
        .mockResolvedValueOnce({ data: null, error: { message: 'timeout', code: '57014' } });

      const note = await resolver.createNote(USER, input);

      expect(note.id).toBe(NOTE_ID);
      expect(note.linkedTaskId).toBeUndefined();
    });

    it('links the task when it is created', async () => {
      db.chain.single
        .mockResolvedValueOnce({ data: noteRow(), error: null })
        .mockResolvedValueOnce({
          data: noteRow({ linked_task_id: TASK_ID, linked_task: { title: 'Rear preload' } }),
          error: null,
        });

      const note = await resolver.createNote(USER, input);

      expect(note).toMatchObject({ linkedTaskId: TASK_ID, linkedTaskTitle: 'Rear preload' });
    });

    it('creates no task without the switch', async () => {
      db.chain.single.mockResolvedValueOnce({ data: noteRow(), error: null });

      await resolver.createNote(USER, { motorcycleId: BIKE_ID, text: NOTE_TEXT });

      expect(tasksService.create).not.toHaveBeenCalled();
    });

    it('a note the database refuses is an error — there is nothing to return', async () => {
      db.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'value too long', code: '22001' },
      });

      await expect(resolver.createNote(USER, input)).rejects.toThrow(BadRequestException);
      expect(tasksService.create).not.toHaveBeenCalled();
    });
  });

  describe('deleteNote', () => {
    it.each([
      ['false', false],
      ['null', null],
    ])('the RPC answering %s is NotFound, not a false result', async (_label, data) => {
      db.rpc.mockResolvedValueOnce({ data, error: null });

      await expect(resolver.deleteNote(USER, NOTE_ID)).rejects.toThrow(NotFoundException);
    });

    it('the RPC answering true is true, and again on a repeat', async () => {
      db.rpc.mockResolvedValue({ data: true, error: null });

      await expect(resolver.deleteNote(USER, NOTE_ID)).resolves.toBe(true);
      await expect(resolver.deleteNote(USER, NOTE_ID)).resolves.toBe(true);
      expect(db.rpc).toHaveBeenCalledWith('soft_delete_note', { note_id: NOTE_ID });
    });
  });

  describe('addNotePhoto', () => {
    const ownPath = `${USER.id}/notes/${NOTE_ID}/1727860000000.webp`;

    it.each([
      ['another rider’s folder', `user-2/notes/${NOTE_ID}/1.webp`],
      ['another note of the same rider', `${USER.id}/notes/note-2/1.webp`],
      ['the expenses folder', `${USER.id}/expenses/${NOTE_ID}/1.webp`],
      ['a prefix look-alike', `${USER.id}/notes/${NOTE_ID}-evil/1.webp`],
      ['a path climbing out with ..', `${USER.id}/notes/${NOTE_ID}/../../../user-2/notes/x/1.webp`],
      ['a path with a doubled slash', `${USER.id}/notes/${NOTE_ID}//1.webp`],
      ['a leading slash', `/${USER.id}/notes/${NOTE_ID}/1.webp`],
      ['an empty path', ''],
    ])('refuses %s before touching the database', async (_label, storagePath) => {
      await expect(resolver.addNotePhoto(USER, { noteId: NOTE_ID, storagePath })).rejects.toThrow(
        BadRequestException,
      );
      expect(db.from).not.toHaveBeenCalled();
    });

    it('the prefix is built from the token’s user: another rider cannot use this rider’s path', async () => {
      const other: AuthUser = { ...USER, id: 'user-2' };

      await expect(
        resolver.addNotePhoto(other, { noteId: NOTE_ID, storagePath: ownPath }),
      ).rejects.toThrow('Invalid storage path');
    });

    it(`refuses photo number ${NOTE_PHOTOS_MAX + 1}`, async () => {
      // Arrange
      db.chain.maybeSingle.mockResolvedValueOnce({ data: noteRow(), error: null });
      db.chain.eq
        .mockReturnValueOnce(db.chain) // notes: id
        .mockReturnValueOnce(db.chain) // notes: user_id
        .mockResolvedValueOnce({ count: NOTE_PHOTOS_MAX, error: null });

      // Act + Assert
      await expect(
        resolver.addNotePhoto(USER, { noteId: NOTE_ID, storagePath: ownPath }),
      ).rejects.toThrow(`Maximum of ${NOTE_PHOTOS_MAX} photos per note`);
      expect(db.chain.insert).not.toHaveBeenCalled();
    });

    it(`accepts photo number ${NOTE_PHOTOS_MAX} and returns its public URL`, async () => {
      db.chain.maybeSingle.mockResolvedValueOnce({ data: noteRow(), error: null });
      db.chain.eq
        .mockReturnValueOnce(db.chain)
        .mockReturnValueOnce(db.chain)
        .mockResolvedValueOnce({ count: NOTE_PHOTOS_MAX - 1, error: null });
      db.chain.single.mockResolvedValueOnce({
        data: {
          id: PHOTO_ID,
          note_id: NOTE_ID,
          user_id: USER.id,
          storage_path: ownPath,
          file_size_bytes: 204800,
          mime_type: 'image/webp',
          created_at: '2026-10-02T10:00:00Z',
        },
        error: null,
      });

      const photo = await resolver.addNotePhoto(USER, {
        noteId: NOTE_ID,
        storagePath: ownPath,
        fileSizeBytes: 204800,
      });

      expect(photo).toMatchObject({
        id: PHOTO_ID,
        noteId: NOTE_ID,
        storagePath: ownPath,
        fileSizeBytes: 204800,
      });
      expect(photo.publicUrl.startsWith(`${SUPABASE_URL}/storage/v1/object/public/`)).toBe(true);
      expect(photo.publicUrl.endsWith(ownPath)).toBe(true);
    });

    it('a photo for a note the rider cannot see is NotFound', async () => {
      db.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });

      await expect(
        resolver.addNotePhoto(USER, { noteId: NOTE_ID, storagePath: ownPath }),
      ).rejects.toThrow(NotFoundException);
    });
  });
});
