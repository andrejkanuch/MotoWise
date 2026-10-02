import { NOTE_PHOTOS_MAX } from '@motovault/types';
import {
  BadRequestException,
  ForbiddenException,
  InternalServerErrorException,
  NotFoundException,
} from '@nestjs/common';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { NotesService } from './notes.service';

const USER_ID = 'user-1';
const NOTE_ID = 'note-1';
const BIKE_ID = 'bike-1';
const TASK_ID = 'task-1';
const SUPABASE_URL = 'https://example.supabase.co';
const FIXTURE_TEXT =
  'Rear preload felt soft two-up on the Pyrenees run — check sag before the next trip.';

/** Chainable Supabase mock: every builder method returns the chain. */
function createSupabaseMock() {
  const chain: Record<string, ReturnType<typeof vi.fn>> = {};
  chain.single = vi.fn();
  chain.maybeSingle = vi.fn();
  for (const method of ['select', 'insert', 'update', 'delete', 'eq', 'in', 'is', 'order']) {
    chain[method] = vi.fn().mockReturnValue(chain);
  }
  const from = vi.fn().mockReturnValue(chain);
  const rpc = vi.fn();
  const remove = vi.fn().mockResolvedValue({ error: null });
  const storage = { from: vi.fn().mockReturnValue({ remove }) };
  return { from, chain, rpc, storage, remove };
}

const noteRow = (overrides: Record<string, unknown> = {}) => ({
  id: NOTE_ID,
  user_id: USER_ID,
  motorcycle_id: BIKE_ID,
  body: FIXTURE_TEXT,
  odometer: 38100,
  linked_task_id: null,
  linked_expense_id: null,
  created_at: '2026-09-28T10:00:00Z',
  updated_at: '2026-09-28T10:00:00Z',
  linked_task: null,
  linked_expense: null,
  ...overrides,
});

describe('NotesService', () => {
  let service: NotesService;
  let mock: ReturnType<typeof createSupabaseMock>;
  let adminMock: ReturnType<typeof createSupabaseMock>;
  let tasksService: { create: ReturnType<typeof vi.fn> };

  beforeEach(() => {
    vi.clearAllMocks();
    mock = createSupabaseMock();
    adminMock = createSupabaseMock();
    tasksService = { create: vi.fn().mockResolvedValue({ id: TASK_ID }) };
    const configMock = { getOrThrow: vi.fn().mockReturnValue(SUPABASE_URL) };
    service = new NotesService(
      mock as never,
      adminMock as never,
      configMock as never,
      tasksService as never,
    );
    // biome-ignore lint/suspicious/noExplicitAny: accessing private logger for test suppression
    (service as any).logger = { debug: vi.fn(), log: vi.fn(), warn: vi.fn(), error: vi.fn() };
  });

  describe('findByMotorcycle', () => {
    it('maps rows to camelCase, newest first, with both link variants', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [
          noteRow({ linked_task_id: TASK_ID, linked_task: { title: '2nd scheduled service' } }),
          noteRow({
            id: 'note-2',
            odometer: null,
            linked_expense_id: 'exp-1',
            linked_expense: { amount: '29.73', currency: 'EUR' },
          }),
        ],
        error: null,
      });

      const result = await service.findByMotorcycle(USER_ID, BIKE_ID);

      expect(mock.from).toHaveBeenCalledWith('notes');
      expect(mock.chain.eq).toHaveBeenCalledWith('motorcycle_id', BIKE_ID);
      expect(mock.chain.is).toHaveBeenCalledWith('deleted_at', null);
      expect(mock.chain.order).toHaveBeenCalledWith('created_at', { ascending: false });
      expect(result[0]).toEqual({
        id: NOTE_ID,
        motorcycleId: BIKE_ID,
        text: FIXTURE_TEXT,
        odometer: 38100,
        createdAt: '2026-09-28T10:00:00Z',
        updatedAt: '2026-09-28T10:00:00Z',
        linkedTaskId: TASK_ID,
        linkedTaskTitle: '2nd scheduled service',
        linkedExpenseId: undefined,
        linkedExpenseAmount: undefined,
        linkedExpenseCurrency: undefined,
      });
      expect(result[1]).toMatchObject({
        odometer: undefined,
        linkedExpenseId: 'exp-1',
        linkedExpenseAmount: 29.73,
        linkedExpenseCurrency: 'EUR',
      });
    });

    it('keeps the link id but no title when the linked task was deleted', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [noteRow({ linked_task_id: TASK_ID, linked_task: null })],
        error: null,
      });

      const [note] = await service.findByMotorcycle(USER_ID, BIKE_ID);

      expect(note.linkedTaskId).toBe(TASK_ID);
      expect(note.linkedTaskTitle).toBeUndefined();
    });

    it('throws InternalServerErrorException on a query error', async () => {
      mock.chain.order.mockResolvedValueOnce({ data: null, error: { message: 'x', code: '1' } });
      await expect(service.findByMotorcycle(USER_ID, BIKE_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('create', () => {
    it('maps camelCase input to snake_case columns', async () => {
      mock.chain.single.mockResolvedValueOnce({ data: noteRow(), error: null });

      const note = await service.create(USER_ID, {
        motorcycleId: BIKE_ID,
        text: FIXTURE_TEXT,
        odometer: 38100,
      });

      expect(mock.chain.insert).toHaveBeenCalledWith({
        user_id: USER_ID,
        motorcycle_id: BIKE_ID,
        body: FIXTURE_TEXT,
        odometer: 38100,
      });
      expect(note.text).toBe(FIXTURE_TEXT);
      expect(tasksService.create).not.toHaveBeenCalled();
    });

    it('stores null when no odometer is given', async () => {
      mock.chain.single.mockResolvedValueOnce({ data: noteRow({ odometer: null }), error: null });

      await service.create(USER_ID, { motorcycleId: BIKE_ID, text: 'Idea: heated grips' });

      expect(mock.chain.insert).toHaveBeenCalledWith(expect.objectContaining({ odometer: null }));
    });

    it('alsoCreateTask creates one low-priority undated task and links it', async () => {
      mock.chain.single
        .mockResolvedValueOnce({ data: noteRow(), error: null })
        .mockResolvedValueOnce({
          data: noteRow({
            linked_task_id: TASK_ID,
            linked_task: { title: 'Rear preload felt soft two-up on the Pyrenees run' },
          }),
          error: null,
        });

      const note = await service.create(USER_ID, {
        motorcycleId: BIKE_ID,
        text: FIXTURE_TEXT,
        alsoCreateTask: true,
      });

      expect(tasksService.create).toHaveBeenCalledTimes(1);
      expect(tasksService.create).toHaveBeenCalledWith(USER_ID, {
        motorcycleId: BIKE_ID,
        title: 'Rear preload felt soft two-up on the Pyrenees run',
        priority: 'low',
        notes: FIXTURE_TEXT,
      });
      expect(mock.chain.update).toHaveBeenCalledWith({ linked_task_id: TASK_ID });
      expect(note.linkedTaskId).toBe(TASK_ID);
    });

    it('returns the saved note unlinked when the task cannot be created', async () => {
      mock.chain.single.mockResolvedValueOnce({ data: noteRow(), error: null });
      tasksService.create.mockRejectedValueOnce(new BadRequestException('nope'));

      const note = await service.create(USER_ID, {
        motorcycleId: BIKE_ID,
        text: FIXTURE_TEXT,
        alsoCreateTask: true,
      });

      expect(note.id).toBe(NOTE_ID);
      expect(note.linkedTaskId).toBeUndefined();
    });

    it('throws ForbiddenException when row-level security rejects the insert (42501)', async () => {
      mock.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy', code: '42501' },
      });
      await expect(
        service.create(USER_ID, { motorcycleId: BIKE_ID, text: FIXTURE_TEXT }),
      ).rejects.toThrow(ForbiddenException);
    });

    it('throws BadRequestException for any other insert error', async () => {
      mock.chain.single.mockResolvedValueOnce({
        data: null,
        error: { message: 'violates check constraint', code: '23514' },
      });
      await expect(
        service.create(USER_ID, { motorcycleId: BIKE_ID, text: FIXTURE_TEXT }),
      ).rejects.toThrow(BadRequestException);
    });
  });

  describe('update', () => {
    it('writes only the provided fields, mapping text to body', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: noteRow({ body: 'Updated' }),
        error: null,
      });

      const note = await service.update(USER_ID, NOTE_ID, { text: 'Updated' });

      expect(mock.chain.update).toHaveBeenCalledWith({ body: 'Updated' });
      expect(note.text).toBe('Updated');
    });

    it('clears the odometer stamp on explicit null', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: noteRow({ odometer: null }),
        error: null,
      });

      await service.update(USER_ID, NOTE_ID, { odometer: null });

      expect(mock.chain.update).toHaveBeenCalledWith({ odometer: null });
    });

    it('throws NotFoundException when no row matches', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.update(USER_ID, NOTE_ID, { text: 'x' })).rejects.toThrow(
        NotFoundException,
      );
    });

    it('throws ForbiddenException when row-level security rejects the update (42501)', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'new row violates row-level security policy', code: '42501' },
      });
      await expect(service.update(USER_ID, NOTE_ID, { text: 'x' })).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('throws BadRequestException for any other update error', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: null,
        error: { message: 'violates check constraint', code: '23514' },
      });
      await expect(service.update(USER_ID, NOTE_ID, { text: 'x' })).rejects.toThrow(
        BadRequestException,
      );
    });
  });

  describe('softDelete', () => {
    it('calls the RPC on the user client with the note id', async () => {
      mock.rpc.mockResolvedValueOnce({ data: true, error: null });

      await service.softDelete(USER_ID, NOTE_ID);

      expect(mock.rpc).toHaveBeenCalledWith('soft_delete_note', { note_id: NOTE_ID });
      expect(adminMock.rpc).not.toHaveBeenCalled();
    });

    it('returns true twice when the RPC answers true twice (idempotent)', async () => {
      mock.rpc.mockResolvedValue({ data: true, error: null });

      await expect(service.softDelete(USER_ID, NOTE_ID)).resolves.toBe(true);
      await expect(service.softDelete(USER_ID, NOTE_ID)).resolves.toBe(true);
    });

    it('throws NotFoundException when the RPC answers false', async () => {
      mock.rpc.mockResolvedValueOnce({ data: false, error: null });
      await expect(service.softDelete(USER_ID, NOTE_ID)).rejects.toThrow(NotFoundException);
    });

    it('throws InternalServerErrorException on an RPC error', async () => {
      mock.rpc.mockResolvedValueOnce({ data: null, error: { message: 'x', code: '1' } });
      await expect(service.softDelete(USER_ID, NOTE_ID)).rejects.toThrow(
        InternalServerErrorException,
      );
    });
  });

  describe('createTaskFromNote', () => {
    it('returns the note unchanged when it already has a live linked task', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: noteRow({ linked_task_id: TASK_ID, linked_task: { title: 'Check sag' } }),
        error: null,
      });

      const note = await service.createTaskFromNote(USER_ID, NOTE_ID);

      expect(tasksService.create).not.toHaveBeenCalled();
      expect(note.linkedTaskTitle).toBe('Check sag');
    });

    it('creates and links a task for an unlinked note', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: noteRow(), error: null });
      mock.chain.single.mockResolvedValueOnce({
        data: noteRow({ linked_task_id: TASK_ID, linked_task: { title: 'T' } }),
        error: null,
      });

      const note = await service.createTaskFromNote(USER_ID, NOTE_ID);

      expect(tasksService.create).toHaveBeenCalledTimes(1);
      expect(note.linkedTaskId).toBe(TASK_ID);
    });

    it('replaces a link whose task was deleted', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: noteRow({ linked_task_id: 'gone', linked_task: null }),
        error: null,
      });
      mock.chain.single.mockResolvedValueOnce({
        data: noteRow({ linked_task_id: TASK_ID, linked_task: { title: 'T' } }),
        error: null,
      });

      await service.createTaskFromNote(USER_ID, NOTE_ID);

      expect(tasksService.create).toHaveBeenCalledTimes(1);
    });

    it("throws NotFoundException for a note that is not the caller's", async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.createTaskFromNote(USER_ID, NOTE_ID)).rejects.toThrow(NotFoundException);
    });
  });

  describe('addPhoto', () => {
    const validPath = `${USER_ID}/notes/${NOTE_ID}/1727860000000.webp`;

    it.each([
      ['another user', `user-2/notes/${NOTE_ID}/1.webp`],
      ['another note', `${USER_ID}/notes/note-2/1.webp`],
      ['the expenses folder', `${USER_ID}/expenses/${NOTE_ID}/1.webp`],
      ['a parent-directory escape', `${USER_ID}/notes/${NOTE_ID}/../../x`],
      ['an escape back into the prefix', `${USER_ID}/notes/${NOTE_ID}/../${NOTE_ID}/1.webp`],
      ['a doubled slash', `${USER_ID}/notes/${NOTE_ID}//1.webp`],
      ['a dot segment', `${USER_ID}/notes/${NOTE_ID}/./1.webp`],
    ])('rejects a path under %s before touching the database', async (_label, path) => {
      await expect(service.addPhoto(USER_ID, NOTE_ID, path)).rejects.toThrow(BadRequestException);
      expect(mock.from).not.toHaveBeenCalled();
    });

    it('rejects a 4th photo', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: noteRow(), error: null });
      // .select('id', { count, head }).eq('note_id') resolves on the final eq.
      mock.chain.eq
        .mockReturnValueOnce(mock.chain) // notes: id
        .mockReturnValueOnce(mock.chain) // notes: user_id
        .mockResolvedValueOnce({ count: NOTE_PHOTOS_MAX, error: null });

      await expect(service.addPhoto(USER_ID, NOTE_ID, validPath)).rejects.toThrow(
        `Maximum of ${NOTE_PHOTOS_MAX} photos per note`,
      );
      expect(mock.chain.insert).not.toHaveBeenCalled();
    });

    it('inserts the link row and returns the public URL', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: noteRow(), error: null });
      mock.chain.eq
        .mockReturnValueOnce(mock.chain)
        .mockReturnValueOnce(mock.chain)
        .mockResolvedValueOnce({ count: 2, error: null });
      mock.chain.single.mockResolvedValueOnce({
        data: {
          id: 'photo-1',
          note_id: NOTE_ID,
          user_id: USER_ID,
          storage_path: validPath,
          file_size_bytes: 2048,
          mime_type: 'image/webp',
          created_at: '2026-10-02T09:00:00Z',
        },
        error: null,
      });

      const photo = await service.addPhoto(USER_ID, NOTE_ID, validPath, 2048);

      expect(mock.chain.insert).toHaveBeenCalledWith({
        note_id: NOTE_ID,
        user_id: USER_ID,
        storage_path: validPath,
        file_size_bytes: 2048,
        mime_type: 'image/webp',
      });
      expect(photo.publicUrl).toBe(
        `${SUPABASE_URL}/storage/v1/object/public/maintenance-photos/${validPath}`,
      );
    });

    it("throws NotFoundException when the note is not the caller's", async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.addPhoto(USER_ID, NOTE_ID, validPath)).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('deletePhoto', () => {
    it('removes the storage object and the row', async () => {
      const path = `${USER_ID}/notes/${NOTE_ID}/1.webp`;
      mock.chain.maybeSingle.mockResolvedValueOnce({
        data: { id: 'photo-1', note_id: NOTE_ID, user_id: USER_ID, storage_path: path },
        error: null,
      });

      await expect(service.deletePhoto(USER_ID, 'photo-1')).resolves.toBe(true);

      expect(adminMock.storage.from).toHaveBeenCalledWith('maintenance-photos');
      expect(adminMock.remove).toHaveBeenCalledWith([path]);
      expect(mock.chain.delete).toHaveBeenCalled();
    });

    it('throws NotFoundException for a photo the caller cannot see', async () => {
      mock.chain.maybeSingle.mockResolvedValueOnce({ data: null, error: null });
      await expect(service.deletePhoto(USER_ID, 'photo-1')).rejects.toThrow(NotFoundException);
      expect(adminMock.remove).not.toHaveBeenCalled();
    });
  });

  describe('findPhotosByNoteIds', () => {
    it('groups photos by note and returns an empty list for notes without any', async () => {
      mock.chain.order.mockResolvedValueOnce({
        data: [
          {
            id: 'photo-1',
            note_id: NOTE_ID,
            user_id: USER_ID,
            storage_path: `${USER_ID}/notes/${NOTE_ID}/1.webp`,
            file_size_bytes: null,
            mime_type: 'image/webp',
            created_at: '2026-10-02T09:00:00Z',
          },
        ],
        error: null,
      });

      const map = await service.findPhotosByNoteIds([NOTE_ID, 'note-2']);

      expect(mock.chain.in).toHaveBeenCalledWith('note_id', [NOTE_ID, 'note-2']);
      expect(map.get(NOTE_ID)).toHaveLength(1);
      expect(map.get('note-2')).toEqual([]);
    });

    it('does not query for an empty id list', async () => {
      const map = await service.findPhotosByNoteIds([]);
      expect(map.size).toBe(0);
      expect(mock.from).not.toHaveBeenCalled();
    });
  });
});
