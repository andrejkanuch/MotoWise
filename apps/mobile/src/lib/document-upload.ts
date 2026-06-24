import { DOCUMENT_MIME_ALLOWLIST, maxBytesForMime } from '@motovault/types';
import * as Crypto from 'expo-crypto';
import * as DocumentPicker from 'expo-document-picker';
import { File } from 'expo-file-system';
import { supabase } from './supabase';
import { withTimeout } from './with-timeout';

const DOCUMENTS_BUCKET = 'documents';
const MIME_ALLOWLIST = new Set<string>(DOCUMENT_MIME_ALLOWLIST);

export interface PickedDocument {
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
}

export interface UploadedDocumentFile {
  storagePath: string;
  fileSizeBytes: number;
  mimeType: string;
}

/** A new document id (uuid v4). Generated client-side so the upload path is known before the row exists. */
export function generateDocumentId(): string {
  return Crypto.randomUUID();
}

/** Per-file upload timeout so a stalled storage request can't pin a tray file in
 *  'uploading' forever (which would block Save, gated on allUploaded). On timeout
 *  the slot flips to 'error' (retryable); any orphaned object is reclaimed by the
 *  U13 reconciliation sweep. */
export const UPLOAD_TIMEOUT_MS = 60_000;

/** Reject `promise` if it hasn't settled within `ms` (default UPLOAD_TIMEOUT_MS). */
export function withUploadTimeout<T>(
  promise: Promise<T>,
  ms: number = UPLOAD_TIMEOUT_MS,
): Promise<T> {
  return withTimeout(promise, ms, 'upload_timeout');
}

/**
 * Best-effort removal of an already-uploaded object — used when the rider removes
 * a file from the tray or abandons the add-document screen before saving, so bytes
 * don't linger until the daily reconciliation sweep. Silent on failure (the sweep
 * is the backstop).
 */
export async function removeUploadedDocumentFile(storagePath: string): Promise<void> {
  try {
    await supabase.storage.from(DOCUMENTS_BUCKET).remove([storagePath]);
  } catch {
    // best-effort; the U13 orphan sweep reclaims anything left behind
  }
}

/**
 * Open the system picker for images + PDFs (multi-select). Returns [] when the
 * user cancels — leaving no partial state. Assets without a resolvable mime type
 * are inferred from the file extension.
 */
export async function pickDocuments(): Promise<PickedDocument[]> {
  const result = await DocumentPicker.getDocumentAsync({
    type: ['application/pdf', 'image/*'],
    multiple: true,
    copyToCacheDirectory: true,
  });
  if (result.canceled) return [];

  return result.assets.map((asset) => ({
    uri: asset.uri,
    name: asset.name,
    mimeType: asset.mimeType ?? inferMimeType(asset.name),
    sizeBytes: asset.size ?? 0,
  }));
}

/** Throws a human-readable reason if a picked file can't be uploaded (caller surfaces it). */
export function validatePickedDocument(doc: PickedDocument): void {
  if (!MIME_ALLOWLIST.has(doc.mimeType)) {
    throw new Error('unsupported_type');
  }
  if (doc.sizeBytes > maxBytesForMime(doc.mimeType)) {
    throw new Error('file_too_large');
  }
}

/**
 * Upload one picked file's RAW bytes to the private documents bucket at
 * {userId}/{motorcycleId}/{documentId}/{fileId}-{name}. PDFs and images are
 * uploaded byte-exact — NO compression / WebP conversion (R2).
 *
 * Bytes are read via expo-file-system's `File.bytes()` (native byte read →
 * Uint8Array). Never `readAsStringAsync` (throw-risk) or `fetch().arrayBuffer()`
 * (Hermes 0-byte).
 */
export async function uploadDocumentFile(
  doc: PickedDocument,
  userId: string,
  motorcycleId: string,
  documentId: string,
): Promise<UploadedDocumentFile> {
  validatePickedDocument(doc);

  const bytes = await new File(doc.uri).bytes();
  const safeName = sanitizeFileName(doc.name);
  const fileId = Crypto.randomUUID().slice(0, 8);
  const storagePath = `${userId}/${motorcycleId}/${documentId}/${fileId}-${safeName}`;

  const { error } = await supabase.storage.from(DOCUMENTS_BUCKET).upload(storagePath, bytes, {
    contentType: doc.mimeType,
    upsert: false,
  });
  if (error) throw error;

  return { storagePath, fileSizeBytes: bytes.byteLength, mimeType: doc.mimeType };
}

const EXT_MIME: Record<string, string> = {
  pdf: 'application/pdf',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
};

function inferMimeType(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? '';
  return EXT_MIME[ext] ?? 'application/octet-stream';
}

/** Strips path separators and collapses unsafe characters so the storage key stays well-formed. */
function sanitizeFileName(name: string): string {
  const base = name.split(/[\\/]/).pop() ?? 'file';
  return base.replace(/[^A-Za-z0-9._-]/g, '_').slice(0, 100) || 'file';
}
