// Bike Document Vault (U3): shared limits, MIME allowlist, and seeded categories.
// Sourced from these constants at the bucket (file_size_limit/allowed_mime_types),
// the DB CHECK, the NestJS DTO, and the mobile uploader — single source of truth.

/** MIME types accepted into the documents vault (matches the bucket allowlist). */
export const DOCUMENT_MIME_ALLOWLIST = [
  'application/pdf',
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;
export type DocumentMimeType = (typeof DOCUMENT_MIME_ALLOWLIST)[number];

/** Maximum files attached to a single document (front/back of a card, etc.). */
export const MAX_FILES_PER_DOCUMENT = 10;

/** Per-file caps. Images 5 MB; PDFs 20 MB (the bucket file_size_limit). */
export const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
export const MAX_PDF_BYTES = 20 * 1024 * 1024;

/** Per-user vault storage cap (bounds growth of a private PII bucket). */
export const MAX_VAULT_BYTES_PER_USER = 500 * 1024 * 1024;

/** Largest allowed single file across all types (PDF). */
export const MAX_DOCUMENT_FILE_BYTES = MAX_PDF_BYTES;

/** Returns the byte cap for a given MIME type. PDFs get the larger cap. */
export function maxBytesForMime(mimeType: string): number {
  return mimeType === 'application/pdf' ? MAX_PDF_BYTES : MAX_IMAGE_BYTES;
}

/**
 * Categories materialized per rider on first vault use. `promptsExpiry` drives
 * the "prompt for an expiry date on add" behavior (R9). Names are the canonical
 * keys; the mobile layer localizes display via t().
 */
export const SEEDED_CATEGORIES = [
  { name: 'Insurance', promptsExpiry: true },
  { name: 'Registration', promptsExpiry: true },
  { name: 'Title/Ownership', promptsExpiry: false },
  { name: 'Inspection', promptsExpiry: true },
  { name: 'Service Records', promptsExpiry: false },
  { name: 'Manual', promptsExpiry: false },
  { name: 'Warranty', promptsExpiry: false },
  { name: 'Receipts', promptsExpiry: false },
] as const;

/** Seeded category names that prompt for an expiry date on add (R9). */
export const EXPIRY_BEARING_CATEGORIES = SEEDED_CATEGORIES.filter((c) => c.promptsExpiry).map(
  (c) => c.name,
) as readonly string[];

/** Category kinds (as-const object — referenced directly instead of magic strings). */
export const DOCUMENT_CATEGORY_KIND = { SEEDED: 'seeded', CUSTOM: 'custom' } as const;
export const DOCUMENT_CATEGORY_KINDS = [
  DOCUMENT_CATEGORY_KIND.SEEDED,
  DOCUMENT_CATEGORY_KIND.CUSTOM,
] as const;
export type DocumentCategoryKind = (typeof DOCUMENT_CATEGORY_KINDS)[number];
