import type {
  AddDocumentCategory,
  DocumentCategoryKind,
  UpdateDocumentCategory,
} from '@motovault/types';
import { DOCUMENT_CATEGORY_KIND, SEEDED_CATEGORIES } from '@motovault/types';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { PG_ERROR } from '../../common/supabase/unwrap';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { DocumentCategory } from './models/document-category.model';

interface CategoryRow {
  id: string;
  name: string;
  kind: DocumentCategoryKind;
  is_hidden: boolean;
  prompts_expiry: boolean;
  created_at: string;
  updated_at: string;
}

@Injectable()
export class DocumentCategoriesService {
  private readonly logger = new Logger(DocumentCategoriesService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  /**
   * Lists the rider's categories, materializing the seeded set on first vault
   * access. The UNIQUE (user_id, name) constraint makes concurrent first-access
   * seeding race-safe (ignoreDuplicates). Hidden categories are excluded unless
   * includeHidden is set.
   */
  async list(userId: string, includeHidden = false): Promise<DocumentCategory[]> {
    // A brand-new vault has no rows for this user at all — seed once, then refetch.
    // (Idempotent: seeding again when only hidden rows remain is a harmless no-op.)
    const anyExist = await this.supabase
      .from('document_categories')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId);
    // Guard on the count query succeeding: a transient read error must not be read
    // as "empty vault" (count → null → 0) and trigger a seed attempt on every
    // request during a DB outage.
    if (!anyExist.error && (anyExist.count ?? 0) === 0) {
      await this.seed(userId);
    }
    return this.fetch(userId, includeHidden);
  }

  /** Idempotent per-user materialization of the seeded categories. */
  private async seed(userId: string): Promise<void> {
    const rows = SEEDED_CATEGORIES.map((c) => ({
      user_id: userId,
      name: c.name,
      kind: DOCUMENT_CATEGORY_KIND.SEEDED,
      prompts_expiry: c.promptsExpiry,
    }));
    const { error } = await this.supabase
      .from('document_categories')
      .upsert(rows, { onConflict: 'user_id,name', ignoreDuplicates: true });
    if (error) {
      this.logger.error(`seed categories failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to seed document categories');
    }
  }

  private async fetch(userId: string, includeHidden: boolean): Promise<DocumentCategory[]> {
    let query = this.supabase
      .from('document_categories')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: true });
    if (!includeHidden) query = query.eq('is_hidden', false);

    const { data, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to fetch document categories');
    return (data ?? []).map((row) => this.mapRow(row as CategoryRow));
  }

  async add(userId: string, input: AddDocumentCategory): Promise<DocumentCategory> {
    const { data, error } = await this.supabase
      .from('document_categories')
      .insert({
        user_id: userId,
        name: input.name,
        kind: DOCUMENT_CATEGORY_KIND.CUSTOM,
        prompts_expiry: false,
      })
      .select('*')
      .single();
    if (error || !data) {
      if (error?.code === PG_ERROR.UNIQUE_VIOLATION) {
        // A category with this name already exists. If it is merely hidden, treat
        // "add" as an idempotent restore (unhide + return) — re-adding a name the
        // rider previously hid should bring it back, not surface a confusing
        // "already exists" error (R7). If it is already visible, the name is taken.
        return this.restoreHiddenOrConflict(userId, input.name);
      }
      this.logger.error(`add category failed: ${error?.message}`);
      throw new BadRequestException('Failed to add category');
    }
    return this.mapRow(data as CategoryRow);
  }

  /** Unhide an existing same-name category, or surface a genuine name conflict. */
  private async restoreHiddenOrConflict(userId: string, name: string): Promise<DocumentCategory> {
    const { data: existing } = await this.supabase
      .from('document_categories')
      .select('*')
      .eq('user_id', userId)
      .eq('name', name)
      .single();
    if (existing && (existing as CategoryRow).is_hidden) {
      const { data: unhidden, error: unhideError } = await this.supabase
        .from('document_categories')
        .update({ is_hidden: false })
        .eq('id', (existing as CategoryRow).id)
        .eq('user_id', userId)
        .select('*')
        .single();
      if (!unhideError && unhidden) return this.mapRow(unhidden as CategoryRow);
    }
    throw new BadRequestException('A category with that name already exists');
  }

  /**
   * Renames and/or hides a category. Hiding sets is_hidden only — it never
   * touches documents.category_id, so documents stay filed and reminders (which
   * key off documents.expiry_date) are unaffected.
   */
  async update(
    userId: string,
    id: string,
    input: UpdateDocumentCategory,
  ): Promise<DocumentCategory> {
    const patch: Record<string, unknown> = {};
    if (input.name !== undefined) patch.name = input.name;
    if (input.isHidden !== undefined) patch.is_hidden = input.isHidden;
    if (Object.keys(patch).length === 0) throw new BadRequestException('No fields to update');

    const { data, error } = await this.supabase
      .from('document_categories')
      .update(patch)
      .eq('id', id)
      .eq('user_id', userId)
      .select('*')
      .single();
    if (error || !data) {
      if (error?.code === PG_ERROR.UNIQUE_VIOLATION) {
        throw new BadRequestException('A category with that name already exists');
      }
      throw new NotFoundException('Category not found');
    }
    return this.mapRow(data as CategoryRow);
  }

  private mapRow(row: CategoryRow): DocumentCategory {
    return {
      id: row.id,
      name: row.name,
      kind: row.kind,
      isHidden: row.is_hidden,
      promptsExpiry: row.prompts_expiry,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}
