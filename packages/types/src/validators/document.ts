import { z } from 'zod';
import {
  DOCUMENT_MIME_ALLOWLIST,
  MAX_DOCUMENT_FILE_BYTES,
  MAX_FILES_PER_DOCUMENT,
} from '../constants/document-limits';

const mimeValues = DOCUMENT_MIME_ALLOWLIST as unknown as [string, ...string[]];

const DateOnly = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Must be YYYY-MM-DD format');

/**
 * One uploaded file in a document. The client uploads bytes to
 * {userId}/{motorcycleId}/{documentId}/{filename} before the row exists, then
 * hands these descriptors to CreateDocument.
 */
export const DocumentFileInputSchema = z.object({
  storagePath: z.string().min(1).max(500),
  fileSizeBytes: z.number().int().positive().max(MAX_DOCUMENT_FILE_BYTES),
  mimeType: z.enum(mimeValues),
});
export type DocumentFileInput = z.infer<typeof DocumentFileInputSchema>;

export const CreateDocumentSchema = z.object({
  // Client-generated so the upload path is known before the row exists; the API
  // enforces row id == path docId segment.
  documentId: z.string().uuid(),
  motorcycleId: z.string().uuid(),
  categoryId: z.string().uuid(),
  title: z.string().min(1).max(200),
  expiryDate: DateOnly.optional(),
  note: z.string().max(2000).optional(),
  files: z.array(DocumentFileInputSchema).min(1).max(MAX_FILES_PER_DOCUMENT),
});
export type CreateDocument = z.infer<typeof CreateDocumentSchema>;

/** Edit is metadata-only in v1 (file replacement deferred). */
export const UpdateDocumentSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  categoryId: z.string().uuid().optional(),
  expiryDate: DateOnly.nullable().optional(),
  note: z.string().max(2000).nullable().optional(),
  isPinned: z.boolean().optional(),
});
export type UpdateDocument = z.infer<typeof UpdateDocumentSchema>;

export const AddDocumentCategorySchema = z.object({
  name: z.string().min(1).max(60),
});
export type AddDocumentCategory = z.infer<typeof AddDocumentCategorySchema>;

export const UpdateDocumentCategorySchema = z.object({
  name: z.string().min(1).max(60).optional(),
  isHidden: z.boolean().optional(),
});
export type UpdateDocumentCategory = z.infer<typeof UpdateDocumentCategorySchema>;
