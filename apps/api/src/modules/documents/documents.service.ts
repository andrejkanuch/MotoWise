import type { CreateDocument, UpdateDocument } from '@motovault/types';
import {
  DOCUMENT_MIME_ALLOWLIST,
  MAX_FILES_PER_DOCUMENT,
  MAX_VAULT_BYTES_PER_USER,
  maxBytesForMime,
} from '@motovault/types';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { DOCUMENT_SIGNED_URL_TTL } from '../../config/constants';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { Document } from './models/document.model';
import type { DocumentFile } from './models/document-file.model';

const STORAGE_BUCKET = 'documents';
const MIME_SET = new Set<string>(DOCUMENT_MIME_ALLOWLIST);

interface DocumentRow {
  id: string;
  user_id: string;
  motorcycle_id: string;
  category_id: string;
  title: string;
  expiry_date: string | null;
  note: string | null;
  is_pinned: boolean;
  created_at: string;
  updated_at: string;
}

interface DocumentFileRow {
  id: string;
  document_id: string;
  user_id: string;
  storage_path: string;
  file_size_bytes: number | null;
  mime_type: string;
  created_at: string;
}

@Injectable()
export class DocumentsService {
  private readonly logger = new Logger(DocumentsService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
  ) {}

  // ==========================================
  // Create
  // ==========================================

  async create(userId: string, input: CreateDocument): Promise<Document> {
    const { documentId, motorcycleId, categoryId, title, files } = input;
    this.logger.log(`create: userId=${userId}, documentId=${documentId}, files=${files.length}`);

    // --- Cheap structural validation BEFORE any DB / storage work ---
    if (files.length < 1 || files.length > MAX_FILES_PER_DOCUMENT) {
      throw new BadRequestException(`A document must have 1–${MAX_FILES_PER_DOCUMENT} files`);
    }
    const expectedPrefix = `${userId}/${motorcycleId}/${documentId}/`;
    for (const file of files) {
      if (!MIME_SET.has(file.mimeType)) {
        throw new BadRequestException(`Unsupported file type: ${file.mimeType}`);
      }
      if (file.fileSizeBytes > maxBytesForMime(file.mimeType)) {
        throw new BadRequestException('File exceeds the size limit for its type');
      }
      // The client uploaded to {userId}/{motorcycleId}/{documentId}/… — enforce the
      // row id equals the path's documentId segment and the path is user+bike rooted.
      if (!file.storagePath.startsWith(expectedPrefix)) {
        this.logger.warn(`create: storage path outside expected prefix. userId=${userId}`);
        // Bytes are already uploaded under a path that doesn't match — best-effort cleanup.
        await this.cleanupObjects(files.map((f) => f.storagePath));
        throw new BadRequestException('Invalid storage path');
      }
    }

    // --- Bike ownership (RLS-scoped user client; excludes soft-deleted) ---
    const { data: bike, error: bikeError } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (bikeError || !bike) {
      await this.cleanupObjects(files.map((f) => f.storagePath));
      throw new ForbiddenException('Motorcycle not found or not owned by user');
    }

    // --- Category ownership (FK only guarantees existence, not ownership) ---
    const { data: category, error: categoryError } = await this.supabase
      .from('document_categories')
      .select('id')
      .eq('id', categoryId)
      .eq('user_id', userId)
      .single();
    if (categoryError || !category) {
      await this.cleanupObjects(files.map((f) => f.storagePath));
      throw new BadRequestException('Category not found');
    }

    // --- Quota (R21): bytes are already uploaded, so an over-quota create must
    //     reject AND delete the uploaded objects (no quota bypass via direct upload) ---
    await this.enforceQuota(userId, files, expectedPrefix);

    // --- Insert parent row with the client-supplied id ---
    const { data: docData, error: docError } = await this.supabase
      .from('documents')
      .insert({
        id: documentId,
        user_id: userId,
        motorcycle_id: motorcycleId,
        category_id: categoryId,
        title,
        expiry_date: input.expiryDate ?? null,
        note: input.note ?? null,
      })
      .select('*')
      .single();
    if (docError || !docData) {
      this.logger.error(`create document insert failed: ${docError?.message} (${docError?.code})`);
      await this.cleanupObjects(files.map((f) => f.storagePath));
      throw new BadRequestException('Failed to create document');
    }

    // --- Insert file rows ---
    const fileRows = files.map((f) => ({
      document_id: documentId,
      user_id: userId,
      storage_path: f.storagePath,
      file_size_bytes: f.fileSizeBytes,
      mime_type: f.mimeType,
    }));
    const { data: filesData, error: filesError } = await this.supabase
      .from('document_files')
      .insert(fileRows)
      .select('*');
    if (filesError || !filesData) {
      this.logger.error(`create files insert failed: ${filesError?.message}`);
      // Roll back the parent row; cascade removes any partial file rows. Guard the
      // rollback itself — if it also fails, a parent row with zero files would
      // otherwise survive silently (a phantom document); log it so it surfaces.
      const { error: rollbackError } = await this.supabase
        .from('documents')
        .delete()
        .eq('id', documentId);
      if (rollbackError) {
        this.logger.error(
          `create rollback failed: orphaned document row ${documentId}: ${rollbackError.message}`,
        );
      }
      await this.cleanupObjects(files.map((f) => f.storagePath));
      throw new BadRequestException('Failed to create document files');
    }

    const doc = this.mapRow(docData as DocumentRow);
    doc.files = (filesData as DocumentFileRow[]).map((r) => this.mapFileRow(r));
    return doc;
  }

  /**
   * Sums the user's stored bytes (via the RLS-scoped document_vault_bytes_used RPC,
   * so one integer crosses the wire instead of every file row); rejects + cleans up
   * if this upload would exceed the cap. This is a deliberate SOFT cap: the
   * read-then-insert is non-atomic, so two highly concurrent creates could jointly
   * exceed it by at most one document's worth — acceptable for v1.
   */
  private async enforceQuota(
    userId: string,
    files: CreateDocument['files'],
    cleanupPrefix: string,
  ): Promise<void> {
    const { data, error } = await this.supabase.rpc('document_vault_bytes_used');
    if (error) {
      this.logger.error(`enforceQuota read failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to check vault quota');
    }
    const existing = Number(data ?? 0);
    const incoming = files.reduce((sum, f) => sum + f.fileSizeBytes, 0);
    if (existing + incoming > MAX_VAULT_BYTES_PER_USER) {
      this.logger.warn(`create: vault quota exceeded for userId=${userId}`);
      await this.cleanupObjects(
        files.map((f) => f.storagePath),
        cleanupPrefix,
      );
      throw new BadRequestException('Vault storage limit reached');
    }
  }

  // ==========================================
  // Read
  // ==========================================

  /** Documents for one bike, excluding documents whose bike is soft-deleted ("follow the bike"). */
  async findByMotorcycle(userId: string, motorcycleId: string): Promise<Document[]> {
    // Verify the bike is owned AND active; a soft-deleted bike yields no documents.
    const { data: bike } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('id', motorcycleId)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .single();
    if (!bike) return [];

    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .eq('motorcycle_id', motorcycleId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to fetch documents');
    return (data ?? []).map((row) => this.mapRow(row as DocumentRow));
  }

  /**
   * Batched lookup for the Motorcycle.documents DataLoader. Relies on RLS to scope
   * to the user; callers pass only active bike ids (loader parent is an active bike).
   */
  async findByMotorcycleIds(motorcycleIds: string[]): Promise<Map<string, Document[]>> {
    const map = new Map<string, Document[]>();
    for (const id of motorcycleIds) map.set(id, []);
    if (motorcycleIds.length === 0) return map;

    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .in('motorcycle_id', motorcycleIds)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    if (error) throw new InternalServerErrorException('Failed to fetch documents');

    for (const row of (data ?? []) as DocumentRow[]) {
      const list = map.get(row.motorcycle_id) ?? [];
      list.push(this.mapRow(row));
      map.set(row.motorcycle_id, list);
    }
    return map;
  }

  /** Soon-expiring documents across the user's active bikes, ascending by expiry. */
  async findExpiring(userId: string, withinDays: number): Promise<Document[]> {
    const { data: bikes } = await this.supabase
      .from('motorcycles')
      .select('id')
      .eq('user_id', userId)
      .is('deleted_at', null);
    const activeBikeIds = (bikes ?? []).map((b: { id: string }) => b.id);
    if (activeBikeIds.length === 0) return [];

    // Horizon = today + withinDays, as a yyyy-mm-dd string for the DATE column.
    // setUTCDate handles month/year rollover without raw millisecond arithmetic.
    const horizonDate = new Date();
    horizonDate.setUTCDate(horizonDate.getUTCDate() + withinDays);
    const horizon = horizonDate.toISOString().split('T')[0];

    const { data, error } = await this.supabase
      .from('documents')
      .select('*')
      .in('motorcycle_id', activeBikeIds)
      .is('deleted_at', null)
      .not('expiry_date', 'is', null)
      .lte('expiry_date', horizon)
      .order('expiry_date', { ascending: true });
    if (error) throw new InternalServerErrorException('Failed to fetch expiring documents');
    return (data ?? []).map((row) => this.mapRow(row as DocumentRow));
  }

  /** Batched file lookup for the Document.files DataLoader. */
  async findFilesByDocumentIds(documentIds: string[]): Promise<Map<string, DocumentFile[]>> {
    const map = new Map<string, DocumentFile[]>();
    for (const id of documentIds) map.set(id, []);
    if (documentIds.length === 0) return map;

    const { data, error } = await this.supabase
      .from('document_files')
      .select('*')
      .in('document_id', documentIds)
      .order('created_at', { ascending: true });
    if (error) throw new InternalServerErrorException('Failed to fetch document files');

    for (const row of (data ?? []) as DocumentFileRow[]) {
      const list = map.get(row.document_id) ?? [];
      list.push(this.mapFileRow(row));
      map.set(row.document_id, list);
    }
    return map;
  }

  // ==========================================
  // Signed URLs (read-time, never persisted)
  // ==========================================

  /**
   * Mints a short-lived signed URL for one file via the per-request USER client so
   * Storage RLS is the real authorization gate (net-new vs health-reports' admin
   * signing). Falls back to the admin client only if the RLS-gated SELECT blocks a
   * legitimate owner — the path is re-validated against the user prefix first.
   */
  async getSignedUrl(userId: string, fileId: string, forDownload: boolean): Promise<string> {
    const { data: file, error } = await this.supabase
      .from('document_files')
      .select('storage_path, user_id')
      .eq('id', fileId)
      .single();
    if (error || !file) throw new NotFoundException('File not found');

    const storagePath = (file as DocumentFileRow).storage_path;
    // Defense-in-depth before handing the path to any signer.
    if (!storagePath.startsWith(`${userId}/`)) {
      this.logger.warn(`getSignedUrl: path outside user prefix. userId=${userId}`);
      throw new NotFoundException('File not found');
    }

    const ttl = forDownload ? DOCUMENT_SIGNED_URL_TTL.DOWNLOAD : DOCUMENT_SIGNED_URL_TTL.DISPLAY;
    // For downloads, ask Storage to set Content-Disposition: attachment so the
    // URL is self-describing for direct/web consumers; display mode streams inline.
    const signOptions = forDownload ? { download: true } : undefined;

    const userSign = await this.supabase.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, ttl, signOptions);
    if (!userSign.error && userSign.data) {
      return userSign.data.signedUrl;
    }

    this.logger.warn(
      `getSignedUrl: user-client signing failed, falling back to admin: ${userSign.error?.message}`,
    );
    const adminSign = await this.adminClient.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, ttl, signOptions);
    if (adminSign.error || !adminSign.data) {
      throw new InternalServerErrorException('Failed to create signed URL');
    }
    return adminSign.data.signedUrl;
  }

  // ==========================================
  // Update (metadata only)
  // ==========================================

  async update(userId: string, id: string, input: UpdateDocument): Promise<Document> {
    // If re-filing to a different category, verify ownership of the target category.
    if (input.categoryId !== undefined) {
      const { data: category } = await this.supabase
        .from('document_categories')
        .select('id')
        .eq('id', input.categoryId)
        .eq('user_id', userId)
        .single();
      if (!category) throw new BadRequestException('Category not found');
    }

    const patch: Record<string, unknown> = {};
    if (input.title !== undefined) patch.title = input.title;
    if (input.categoryId !== undefined) patch.category_id = input.categoryId;
    if (input.expiryDate !== undefined) patch.expiry_date = input.expiryDate;
    if (input.note !== undefined) patch.note = input.note;
    if (input.isPinned !== undefined) patch.is_pinned = input.isPinned;
    if (Object.keys(patch).length === 0) throw new BadRequestException('No fields to update');

    const { data, error } = await this.supabase
      .from('documents')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .is('deleted_at', null)
      .select('*')
      .single();
    if (error || !data) {
      this.logger.error(`update failed: ${error?.message} (${error?.code})`);
      throw new NotFoundException('Document not found');
    }
    return this.mapRow(data as DocumentRow);
  }

  // ==========================================
  // Delete (storage-first, then row)
  // ==========================================

  async delete(userId: string, id: string): Promise<boolean> {
    // Verify ownership + collect file paths via the RLS-scoped user client.
    const { data: doc, error: docError } = await this.supabase
      .from('documents')
      .select('id')
      .eq('id', id)
      .eq('user_id', userId)
      .single();
    if (docError || !doc) throw new NotFoundException('Document not found');

    const { data: fileRows, error: filesError } = await this.supabase
      .from('document_files')
      .select('storage_path')
      .eq('document_id', id);
    if (filesError) throw new InternalServerErrorException('Failed to read document files');

    const paths = (fileRows ?? [])
      .map((r: { storage_path: string }) => r.storage_path)
      // Defense-in-depth: never hand the admin client a path outside the user prefix.
      .filter((p: string) => p.startsWith(`${userId}/`));

    // Row-first: delete the row (cascade removes document_files), THEN the objects.
    // Ordering is the whole correctness argument here. If the row delete fails, no
    // objects were touched and the operation is fully retryable. If object removal
    // fails AFTER the row is gone, those objects are now true orphans (no
    // document_files row) that the U13 reconciliation sweep reclaims — a benign,
    // self-healing state. The inverse (storage-first) could leave a row whose bytes
    // are already gone, which the orphan sweep CANNOT reclaim (it only deletes an
    // object lacking a row), stranding a permanently-404 document. Row-first makes
    // both failure directions recoverable.
    const { error: rowError } = await this.supabase
      .from('documents')
      .delete()
      .eq('id', id)
      .eq('user_id', userId);
    if (rowError) {
      this.logger.error(`delete: row removal failed for document ${id}: ${rowError.message}`);
      throw new InternalServerErrorException('Failed to delete document');
    }

    if (paths.length > 0) {
      const { error: storageError } = await this.adminClient.storage
        .from(STORAGE_BUCKET)
        .remove(paths);
      if (storageError) {
        // The row is already gone, so the delete succeeded from the caller's view;
        // the objects are now reclaimable orphans. Log and let the reconciliation
        // sweep handle them rather than failing an operation that already committed.
        this.logger.warn(
          `delete: storage removal failed for document ${id} (orphan sweep will reconcile): ${storageError.message}`,
        );
      }
    }
    return true;
  }

  // ==========================================
  // Helpers
  // ==========================================

  /** Best-effort removal of uploaded objects on a failed create. */
  private async cleanupObjects(paths: string[], requirePrefix?: string): Promise<void> {
    const safe = requirePrefix ? paths.filter((p) => p.startsWith(requirePrefix)) : paths;
    if (safe.length === 0) return;
    const { error } = await this.adminClient.storage.from(STORAGE_BUCKET).remove(safe);
    if (error) {
      this.logger.warn(`cleanupObjects failed (orphan sweep will reconcile): ${error.message}`);
    }
  }

  private mapRow(row: DocumentRow): Document {
    return {
      id: row.id,
      motorcycleId: row.motorcycle_id,
      categoryId: row.category_id,
      title: row.title,
      expiryDate: row.expiry_date ?? undefined,
      note: row.note ?? undefined,
      isPinned: row.is_pinned,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      files: [],
    };
  }

  private mapFileRow(row: DocumentFileRow): DocumentFile {
    return {
      id: row.id,
      documentId: row.document_id,
      storagePath: row.storage_path,
      fileSizeBytes: row.file_size_bytes ?? undefined,
      mimeType: row.mime_type,
      createdAt: row.created_at,
    };
  }
}
