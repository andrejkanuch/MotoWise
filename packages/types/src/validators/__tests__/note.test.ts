import { describe, expect, it } from 'vitest';
import { NOTE_TEXT_MAX, ODOMETER_MAX } from '../../constants/limits';
import { AddNotePhotoSchema, CreateNoteSchema, UpdateNoteSchema } from '../note';

const MOTORCYCLE_ID = '22222222-2222-4222-8222-222222222222';
const NOTE_ID = '33333333-3333-4333-8333-333333333333';

const baseInput = { motorcycleId: MOTORCYCLE_ID, text: 'Rear preload felt soft two-up.' };

describe('CreateNoteSchema', () => {
  it('accepts text only', () => {
    expect(CreateNoteSchema.parse(baseInput)).toEqual(baseInput);
  });

  it('accepts an odometer stamp and the task switch', () => {
    const parsed = CreateNoteSchema.parse({ ...baseInput, odometer: 38100, alsoCreateTask: true });
    expect(parsed.odometer).toBe(38100);
    expect(parsed.alsoCreateTask).toBe(true);
  });

  it('trims the text', () => {
    expect(CreateNoteSchema.parse({ ...baseInput, text: '  check sag  ' }).text).toBe('check sag');
  });

  it('rejects empty text', () => {
    expect(CreateNoteSchema.safeParse({ ...baseInput, text: '' }).success).toBe(false);
  });

  it('rejects whitespace-only text', () => {
    expect(CreateNoteSchema.safeParse({ ...baseInput, text: '  \n\t ' }).success).toBe(false);
  });

  it('accepts text at the limit and rejects one character more', () => {
    const atLimit = { ...baseInput, text: 'a'.repeat(NOTE_TEXT_MAX) };
    const overLimit = { ...baseInput, text: 'a'.repeat(NOTE_TEXT_MAX + 1) };
    expect(CreateNoteSchema.safeParse(atLimit).success).toBe(true);
    expect(CreateNoteSchema.safeParse(overLimit).success).toBe(false);
  });

  it.each([
    ['negative', -1],
    ['fractional', 38100.5],
    ['above the maximum', ODOMETER_MAX + 1],
  ])('rejects a %s odometer', (_label, odometer) => {
    expect(CreateNoteSchema.safeParse({ ...baseInput, odometer }).success).toBe(false);
  });

  it('rejects a motorcycleId that is not a uuid', () => {
    expect(CreateNoteSchema.safeParse({ ...baseInput, motorcycleId: 'bike-1' }).success).toBe(
      false,
    );
  });
});

describe('UpdateNoteSchema', () => {
  it('accepts a partial update', () => {
    expect(UpdateNoteSchema.parse({ text: 'Updated' })).toEqual({ text: 'Updated' });
  });

  it('accepts null to clear the odometer stamp', () => {
    expect(UpdateNoteSchema.parse({ odometer: null })).toEqual({ odometer: null });
  });

  it('rejects whitespace-only text', () => {
    expect(UpdateNoteSchema.safeParse({ text: '   ' }).success).toBe(false);
  });
});

describe('AddNotePhotoSchema', () => {
  it('accepts a storage path with an optional size', () => {
    const input = { noteId: NOTE_ID, storagePath: 'user/notes/note/1.webp', fileSizeBytes: 2048 };
    expect(AddNotePhotoSchema.parse(input)).toEqual(input);
  });

  it('rejects an empty storage path', () => {
    expect(AddNotePhotoSchema.safeParse({ noteId: NOTE_ID, storagePath: '' }).success).toBe(false);
  });
});
