import { z } from 'zod';
import { NOTE_TEXT_MAX, ODOMETER_MAX } from '../constants/limits';

const noteTextSchema = z.string().trim().min(1).max(NOTE_TEXT_MAX);
const noteOdometerSchema = z.number().int().min(0).max(ODOMETER_MAX);

export const CreateNoteSchema = z.object({
  motorcycleId: z.string().uuid(),
  text: noteTextSchema,
  /** Raw value in the bike's distance unit. */
  odometer: noteOdometerSchema.optional(),
  /** Also create a low-priority, undated maintenance task from this note. */
  alsoCreateTask: z.boolean().optional(),
});
export type CreateNote = z.infer<typeof CreateNoteSchema>;

export const UpdateNoteSchema = z.object({
  text: noteTextSchema.optional(),
  /** `null` clears the odometer stamp. */
  odometer: noteOdometerSchema.nullable().optional(),
});
export type UpdateNote = z.infer<typeof UpdateNoteSchema>;

export const AddNotePhotoSchema = z.object({
  noteId: z.string().uuid(),
  storagePath: z.string().min(1).max(500),
  fileSizeBytes: z.number().int().positive().optional(),
});
export type AddNotePhoto = z.infer<typeof AddNotePhotoSchema>;
