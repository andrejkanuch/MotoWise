import type { CreateBlogCategoryInput, CreateBlogKeywordInput } from '@motovault/types';
import { BlogPostStatus, BlogTypeDataSchema, CACHE_TAGS } from '@motovault/types';
import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import {
  buildConnection,
  clampFirst,
  decodeCursor,
  encodeCursor,
} from '../../common/pagination/connection';
import { RevalidationService } from '../../common/revalidation/revalidation.service';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { translationToRow, typeDataToRow } from './blog-write';
import type { CreateBlogPostInput } from './dto/create-blog-post.input';
import type { ListBlogPostsInput } from './dto/list-blog-posts.input';
import type { ScheduleBlogPostInput } from './dto/schedule-blog-post.input';
import type { UpdateBlogPostInput } from './dto/update-blog-post.input';
import type {
  BlogCategory,
  BlogKeyword,
  BlogPost,
  BlogPostVersion,
  BlogTranslation,
} from './models/blog-post.model';
import { BlogPostConnection } from './models/blog-post-connection.model';

/** kebab-case a free-text taxonomy label into a slug (mirrors the import script's slugify). */
function slugify(label: string): string {
  return label
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '') // strip combining diacritics
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/** Joined select used for both list and detail — base + translations + taxonomy + per-type rows. */
const POST_SELECT = `
  id, type, slug, status, published_at, scheduled_for, author, cover_image, cover_alt,
  spec_data, is_safety_critical, created_at, updated_at,
  blog_post_translations(locale, title, excerpt, seo_title, seo_description, body_raw, faq, reading_time, word_count),
  blog_post_categories(is_primary, categories(id, slug, name, parent_id)),
  blog_post_keywords(keywords(id, slug, name)),
  blog_post_guide(difficulty, meta),
  blog_post_maintenance(make, model, variant, dataset_models, applicable_models, meta),
  blog_post_trip(distance_km, country_codes, route_gpx, meta),
  blog_post_gear(brand, model, rating, price_eur, verdict, meta)
`;

/** PostgREST returns 1:1 embeds as either an object or a single-element array depending on
 * relationship detection; normalize to the first row (or null). */
function firstOf<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null;
  return value ?? null;
}

@Injectable()
export class BlogService {
  private readonly logger = new Logger(BlogService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    private readonly revalidation: RevalidationService,
  ) {
    this.mapRow = this.mapRow.bind(this);
  }

  /** Admin gate — DB role check (the JWT role claim is informational only). */
  private async assertAdmin(userId: string): Promise<void> {
    const { data: caller, error } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
    // A DB/RLS failure must not masquerade as an authorization denial — otherwise a
    // transient Supabase outage 403s every admin instead of surfacing a 500.
    if (error) {
      this.logger.error(`assertAdmin role lookup failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to verify admin role');
    }
    if (caller?.role !== 'admin') throw new ForbiddenException('Admin only');
  }

  /** List posts (all statuses) for the admin dashboard, newest first, cursor-paginated. */
  async adminList(userId: string, input: ListBlogPostsInput): Promise<BlogPostConnection> {
    await this.assertAdmin(userId);
    const limit = clampFirst(input.first ?? 20);

    let query = this.supabase
      .from('blog_posts')
      .select(POST_SELECT, { count: 'exact' })
      .order('created_at', { ascending: false })
      .limit(limit + 1);

    if (input.status) query = query.eq('status', input.status);
    if (input.type) query = query.eq('type', input.type);
    if (input.after) {
      const decoded = decodeCursor(input.after);
      if (!decoded) throw new BadRequestException('Invalid cursor');
      query = query.lt('created_at', decoded[0]);
    }

    const { data, count, error } = await query;
    if (error) {
      this.logger.error(`adminList failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to list blog posts');
    }

    const rows = (data ?? []) as unknown as RawPostRow[];
    return buildConnection({
      rows,
      limit,
      mapNode: this.mapRow,
      cursorOf: (row) => encodeCursor(row.created_at),
      totalCount: count ?? 0,
      hasPreviousPage: !!input.after,
    });
  }

  /** Fetch one post (any status) for the admin editor. */
  async adminGet(userId: string, id: string): Promise<BlogPost | null> {
    await this.assertAdmin(userId);
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select(POST_SELECT)
      .eq('id', id)
      .maybeSingle();

    if (error) {
      this.logger.error(`adminGet failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to fetch blog post');
    }
    if (!data) return null;
    return this.mapRow(data as unknown as RawPostRow);
  }

  // --- Row mapping (snake_case DB -> camelCase contract) ----------------------

  mapRow(row: RawPostRow): BlogPost {
    return {
      id: row.id,
      type: row.type,
      slug: row.slug,
      status: row.status,
      publishedAt: row.published_at ?? undefined,
      scheduledFor: row.scheduled_for ?? undefined,
      author: row.author ?? undefined,
      coverImage: row.cover_image ?? undefined,
      coverAlt: row.cover_alt ?? undefined,
      specData: row.spec_data,
      isSafetyCritical: row.is_safety_critical,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
      typeData: this.mapTypeData(row),
      translations: (row.blog_post_translations ?? []).map(mapTranslation),
      categories: (row.blog_post_categories ?? []).map(mapCategory),
      keywords: (row.blog_post_keywords ?? [])
        .map((k) => firstOf(k.keywords))
        .filter((k): k is RawKeyword => k != null)
        .map(mapKeyword),
    };
  }

  /** Assemble the per-type JSON payload (camelCased) from whichever per-type row matches `type`. */
  private mapTypeData(row: RawPostRow): Record<string, unknown> | undefined {
    switch (row.type) {
      case 'guide': {
        const g = firstOf(row.blog_post_guide);
        return g
          ? { type: 'guide', difficulty: g.difficulty ?? null, meta: g.meta ?? {} }
          : undefined;
      }
      case 'maintenance': {
        const m = firstOf(row.blog_post_maintenance);
        return m
          ? {
              type: 'maintenance',
              make: m.make ?? null,
              model: m.model ?? null,
              variant: m.variant ?? null,
              datasetModels: m.dataset_models ?? [],
              applicableModels: m.applicable_models ?? [],
              meta: m.meta ?? {},
            }
          : undefined;
      }
      case 'trip': {
        const t = firstOf(row.blog_post_trip);
        return t
          ? {
              type: 'trip',
              distanceKm: t.distance_km ?? null,
              countryCodes: t.country_codes ?? [],
              routeGpx: t.route_gpx ?? null,
              meta: t.meta ?? {},
            }
          : undefined;
      }
      case 'gear': {
        const g = firstOf(row.blog_post_gear);
        return g
          ? {
              type: 'gear',
              brand: g.brand ?? null,
              model: g.model ?? null,
              rating: g.rating ?? null,
              priceEur: g.price_eur ?? null,
              verdict: g.verdict ?? null,
              meta: g.meta ?? {},
            }
          : undefined;
      }
      default:
        return undefined;
    }
  }

  // --- Mutations (admin) -----------------------------------------------------

  async create(userId: string, input: CreateBlogPostInput): Promise<BlogPost> {
    await this.assertAdmin(userId);
    // The per-type table is chosen from typeData.type (writeTypeRow); if it disagrees
    // with the post's base type the read mapper and the write router diverge, leaving an
    // orphaned per-type row. Reject the mismatch up front.
    if (input.typeData.type !== input.type) {
      throw new BadRequestException(
        `typeData.type (${input.typeData.type}) must match post type (${input.type})`,
      );
    }
    const status = input.status ?? BlogPostStatus.DRAFT;

    const { data: post, error } = await this.supabase
      .from('blog_posts')
      .insert({
        type: input.type,
        slug: input.slug,
        status,
        author: input.author ?? null,
        cover_image: input.coverImage ?? null,
        cover_alt: input.coverAlt ?? null,
        spec_data: input.specData ?? false,
        is_safety_critical: input.isSafetyCritical ?? false,
        scheduled_for: input.scheduledFor ?? null,
        published_at: status === BlogPostStatus.PUBLISHED ? new Date().toISOString() : null,
      })
      .select('id')
      .single();
    if (error) {
      this.logger.error(`create failed: ${error.message}`);
      throw new InternalServerErrorException('Failed to create blog post');
    }
    const postId = (post as { id: string }).id;

    await this.writeTypeRow(postId, input.typeData);
    const keywordText = await this.resolveKeywordText(input.keywordIds ?? []);
    await this.writeTranslations(postId, input.translations, keywordText);
    await this.writeTaxonomy(postId, input.categoryIds ?? [], input.keywordIds ?? []);

    if (status === BlogPostStatus.PUBLISHED) {
      await this.writeVersionSnapshot(postId, userId);
      this.revalidatePost(input.slug);
    }
    return this.requireGet(userId, postId);
  }

  async update(userId: string, input: UpdateBlogPostInput): Promise<BlogPost> {
    await this.assertAdmin(userId);

    const patch: Record<string, unknown> = {};
    if (input.author !== undefined) patch.author = input.author;
    if (input.coverImage !== undefined) patch.cover_image = input.coverImage;
    if (input.coverAlt !== undefined) patch.cover_alt = input.coverAlt;
    if (input.specData !== undefined) patch.spec_data = input.specData;
    if (input.isSafetyCritical !== undefined) patch.is_safety_critical = input.isSafetyCritical;
    if (Object.keys(patch).length > 0) {
      const { error } = await this.supabase.from('blog_posts').update(patch).eq('id', input.id);
      if (error) throw new InternalServerErrorException(`Failed to update post: ${error.message}`);
    }

    if (input.typeData) {
      // type is immutable after creation; reject typeData whose discriminant disagrees
      // with the stored base type so we never write an orphaned per-type row.
      const { data: typeRow, error: typeErr } = await this.supabase
        .from('blog_posts')
        .select('type')
        .eq('id', input.id)
        .single();
      if (typeErr)
        throw new InternalServerErrorException(`Failed to load post: ${typeErr.message}`);
      const baseType = (typeRow as { type: string } | null)?.type;
      if (input.typeData.type !== baseType) {
        throw new BadRequestException(
          `typeData.type (${input.typeData.type}) must match post type (${baseType})`,
        );
      }
      await this.writeTypeRow(input.id, input.typeData);
    }

    if (input.translations) {
      const keywordText =
        input.keywordIds !== undefined
          ? await this.resolveKeywordText(input.keywordIds)
          : await this.currentKeywordText(input.id);
      await this.writeTranslations(input.id, input.translations, keywordText);
    }

    if (input.categoryIds !== undefined || input.keywordIds !== undefined) {
      await this.writeTaxonomy(
        input.id,
        input.categoryIds ?? (await this.currentCategoryIds(input.id)),
        input.keywordIds ?? (await this.currentKeywordIds(input.id)),
      );
    }

    const basic = await this.fetchBasic(input.id);
    if (basic.status === BlogPostStatus.PUBLISHED) this.revalidatePost(basic.slug);
    return this.requireGet(userId, input.id);
  }

  async publish(userId: string, id: string): Promise<BlogPost> {
    await this.assertAdmin(userId);
    const basic = await this.fetchBasic(id);
    await this.writeVersionSnapshot(id, userId);
    const { error } = await this.supabase
      .from('blog_posts')
      .update({
        status: BlogPostStatus.PUBLISHED,
        published_at: basic.publishedAt ?? new Date().toISOString(),
      })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Failed to publish: ${error.message}`);
    this.revalidatePost(basic.slug);
    return this.requireGet(userId, id);
  }

  async schedule(userId: string, input: ScheduleBlogPostInput): Promise<BlogPost> {
    await this.assertAdmin(userId);
    const { error } = await this.supabase
      .from('blog_posts')
      .update({ status: BlogPostStatus.SCHEDULED, scheduled_for: input.scheduledFor })
      .eq('id', input.id);
    if (error) throw new InternalServerErrorException(`Failed to schedule: ${error.message}`);
    return this.requireGet(userId, input.id);
  }

  async unpublish(userId: string, id: string): Promise<BlogPost> {
    await this.assertAdmin(userId);
    const basic = await this.fetchBasic(id);
    const { error } = await this.supabase
      .from('blog_posts')
      .update({ status: BlogPostStatus.DRAFT })
      .eq('id', id);
    if (error) throw new InternalServerErrorException(`Failed to unpublish: ${error.message}`);
    this.revalidatePost(basic.slug); // drop it from the public listing
    return this.requireGet(userId, id);
  }

  async remove(userId: string, id: string): Promise<boolean> {
    await this.assertAdmin(userId);
    const basic = await this.fetchBasic(id);
    const { error } = await this.supabase.from('blog_posts').delete().eq('id', id);
    if (error) throw new InternalServerErrorException(`Failed to delete: ${error.message}`);
    this.revalidatePost(basic.slug);
    return true;
  }

  async revertVersion(userId: string, id: string, versionNum: number): Promise<BlogPost> {
    await this.assertAdmin(userId);
    const { data: v, error: vErr } = await this.supabase
      .from('blog_post_versions')
      .select('snapshot')
      .eq('post_id', id)
      .eq('version_num', versionNum)
      .maybeSingle();
    if (vErr) throw new InternalServerErrorException(`Failed to load version: ${vErr.message}`);
    if (!v) throw new BadRequestException('Version not found');
    const snapshot = (v as { snapshot: VersionSnapshot }).snapshot;

    // Snapshot the current state first so a revert is itself versioned (non-destructive).
    await this.writeVersionSnapshot(id, userId);

    // Revert restores CONTENT, not workflow state. `publish()` snapshots the row
    // *before* flipping status, so a publish-time snapshot carries status='draft';
    // restoring it would silently unpublish a live post. Strip status/published_at/
    // scheduled_for (and the managed id/timestamps) so a revert never changes
    // whether the post is live.
    const {
      id: _id,
      created_at: _c,
      updated_at: _u,
      status: _status,
      published_at: _publishedAt,
      scheduled_for: _scheduledFor,
      ...restorable
    } = snapshot.post ?? {};
    if (Object.keys(restorable).length > 0) {
      const { error: updErr } = await this.supabase
        .from('blog_posts')
        .update(restorable)
        .eq('id', id);
      if (updErr)
        throw new InternalServerErrorException(`Failed to restore post: ${updErr.message}`);
    }
    if (Array.isArray(snapshot.translations) && snapshot.translations.length > 0) {
      // search_vector is trigger-maintained; created_at/updated_at are managed — drop them.
      const rows = snapshot.translations.map((t) => {
        const { search_vector: _sv, created_at: _tc, updated_at: _tu, ...rest } = t;
        return rest;
      });
      const { error: upErr } = await this.supabase
        .from('blog_post_translations')
        .upsert(rows, { onConflict: 'post_id,locale' });
      if (upErr)
        throw new InternalServerErrorException(`Failed to restore translations: ${upErr.message}`);
    }

    const basic = await this.fetchBasic(id);
    if (basic.status === BlogPostStatus.PUBLISHED) this.revalidatePost(basic.slug);
    return this.requireGet(userId, id);
  }

  // --- Versions + taxonomy (admin) -------------------------------------------

  /** List a post's snapshots, newest first, for the admin version-history drawer (U9). */
  async listVersions(userId: string, postId: string): Promise<BlogPostVersion[]> {
    await this.assertAdmin(userId);
    const { data, error } = await this.supabase
      .from('blog_post_versions')
      .select('version_num, snapshot, created_by, created_at')
      .eq('post_id', postId)
      .order('version_num', { ascending: false });
    if (error) throw new InternalServerErrorException(`Failed to list versions: ${error.message}`);

    return ((data ?? []) as RawVersionRow[]).map((v) => {
      const translations = Array.isArray(v.snapshot?.translations) ? v.snapshot.translations : [];
      const en = translations.find((t) => t.locale === 'en') ?? translations[0];
      return {
        versionNum: v.version_num,
        title: typeof en?.title === 'string' ? en.title : undefined,
        status: typeof v.snapshot?.post?.status === 'string' ? v.snapshot.post.status : undefined,
        createdBy: v.created_by ?? undefined,
        createdAt: v.created_at,
      };
    });
  }

  /** All categories for the editor's picker (public-read, admin-gated through the resolver). */
  async listCategories(userId: string): Promise<BlogCategory[]> {
    await this.assertAdmin(userId);
    const { data, error } = await this.supabase
      .from('categories')
      .select('id, slug, name, parent_id')
      .order('name', { ascending: true });
    if (error)
      throw new InternalServerErrorException(`Failed to list categories: ${error.message}`);
    return ((data ?? []) as RawCategory[]).map((c) => ({
      id: c.id,
      slug: c.slug,
      name: c.name,
      parentId: c.parent_id ?? undefined,
    }));
  }

  /** All keywords for the editor's picker. */
  async listKeywords(userId: string): Promise<BlogKeyword[]> {
    await this.assertAdmin(userId);
    const { data, error } = await this.supabase
      .from('keywords')
      .select('id, slug, name')
      .order('name', { ascending: true });
    if (error) throw new InternalServerErrorException(`Failed to list keywords: ${error.message}`);
    return ((data ?? []) as RawKeyword[]).map(mapKeyword);
  }

  /** Create-or-return a category by name (slug derived; idempotent on slug). */
  async createCategory(userId: string, input: CreateBlogCategoryInput): Promise<BlogCategory> {
    await this.assertAdmin(userId);
    const slug = slugify(input.name);
    if (!slug) throw new BadRequestException('Category name produced an empty slug');
    const { data, error } = await this.supabase
      .from('categories')
      .upsert({ slug, name: input.name, parent_id: input.parentId ?? null }, { onConflict: 'slug' })
      .select('id, slug, name, parent_id')
      .single();
    if (error)
      throw new InternalServerErrorException(`Failed to create category: ${error.message}`);
    const c = data as RawCategory;
    return { id: c.id, slug: c.slug, name: c.name, parentId: c.parent_id ?? undefined };
  }

  /** Create-or-return a keyword by name (slug derived; idempotent on slug). */
  async createKeyword(userId: string, input: CreateBlogKeywordInput): Promise<BlogKeyword> {
    await this.assertAdmin(userId);
    const slug = slugify(input.name);
    if (!slug) throw new BadRequestException('Keyword name produced an empty slug');
    const { data, error } = await this.supabase
      .from('keywords')
      .upsert({ slug, name: input.name }, { onConflict: 'slug' })
      .select('id, slug, name')
      .single();
    if (error) throw new InternalServerErrorException(`Failed to create keyword: ${error.message}`);
    return mapKeyword(data as RawKeyword);
  }

  // --- Mutation helpers ------------------------------------------------------

  private async requireGet(userId: string, id: string): Promise<BlogPost> {
    const post = await this.adminGet(userId, id);
    if (!post) throw new InternalServerErrorException('Post not found after write');
    return post;
  }

  private async writeTypeRow(postId: string, typeData: Record<string, unknown>): Promise<void> {
    const parsed = BlogTypeDataSchema.parse(typeData);
    const { table, row } = typeDataToRow(postId, parsed);
    const { error } = await this.supabase.from(table).upsert(row, { onConflict: 'post_id' });
    if (error) throw new InternalServerErrorException(`Failed to write ${table}: ${error.message}`);
  }

  private async writeTranslations(
    postId: string,
    translations: CreateBlogPostInput['translations'],
    keywordText: string,
  ): Promise<void> {
    if (translations.length === 0) return;
    const rows = translations.map((t) => translationToRow(postId, t, keywordText));
    const { error } = await this.supabase
      .from('blog_post_translations')
      .upsert(rows, { onConflict: 'post_id,locale' });
    if (error)
      throw new InternalServerErrorException(`Failed to write translations: ${error.message}`);
  }

  /** Replace a post's category + keyword links (the keyword trigger refreshes keyword_text). */
  private async writeTaxonomy(
    postId: string,
    categoryIds: string[],
    keywordIds: string[],
  ): Promise<void> {
    const { error: delCatErr } = await this.supabase
      .from('blog_post_categories')
      .delete()
      .eq('post_id', postId);
    if (delCatErr)
      throw new InternalServerErrorException(`Failed to clear categories: ${delCatErr.message}`);
    if (categoryIds.length > 0) {
      const rows = categoryIds.map((categoryId, i) => ({
        post_id: postId,
        category_id: categoryId,
        is_primary: i === 0,
      }));
      const { error } = await this.supabase.from('blog_post_categories').insert(rows);
      if (error)
        throw new InternalServerErrorException(`Failed to link categories: ${error.message}`);
    }

    const { error: delKwErr } = await this.supabase
      .from('blog_post_keywords')
      .delete()
      .eq('post_id', postId);
    if (delKwErr)
      throw new InternalServerErrorException(`Failed to clear keywords: ${delKwErr.message}`);
    if (keywordIds.length > 0) {
      const rows = keywordIds.map((keywordId) => ({ post_id: postId, keyword_id: keywordId }));
      const { error } = await this.supabase.from('blog_post_keywords').insert(rows);
      if (error)
        throw new InternalServerErrorException(`Failed to link keywords: ${error.message}`);
    }
  }

  private async writeVersionSnapshot(postId: string, userId: string): Promise<void> {
    const { data: base, error: baseErr } = await this.supabase
      .from('blog_posts')
      .select('*')
      .eq('id', postId)
      .single();
    // Guard the reads: a swallowed error here writes a {post: null} snapshot that a
    // later revert would apply, wiping the post's content.
    if (baseErr || !base) {
      throw new InternalServerErrorException(
        `Failed to snapshot post: ${baseErr?.message ?? 'post not found'}`,
      );
    }
    const { data: translations, error: trErr } = await this.supabase
      .from('blog_post_translations')
      .select('*')
      .eq('post_id', postId);
    if (trErr) {
      throw new InternalServerErrorException(`Failed to snapshot translations: ${trErr.message}`);
    }
    const { data: maxRow } = await this.supabase
      .from('blog_post_versions')
      .select('version_num')
      .eq('post_id', postId)
      .order('version_num', { ascending: false })
      .limit(1)
      .maybeSingle();
    const nextVersion = ((maxRow as { version_num?: number } | null)?.version_num ?? 0) + 1;

    const { error } = await this.supabase.from('blog_post_versions').insert({
      post_id: postId,
      version_num: nextVersion,
      snapshot: { post: base, translations: translations ?? [] },
      created_by: userId,
    });
    if (error) throw new InternalServerErrorException(`Failed to write version: ${error.message}`);
  }

  private revalidatePost(slug: string): void {
    this.revalidation.revalidate({ tags: [CACHE_TAGS.blog], paths: ['/blog', `/blog/${slug}`] });
  }

  private async fetchBasic(
    id: string,
  ): Promise<{ slug: string; status: string; publishedAt: string | null }> {
    const { data, error } = await this.supabase
      .from('blog_posts')
      .select('slug, status, published_at')
      .eq('id', id)
      .single();
    if (error && error.code !== 'PGRST116') {
      // PGRST116 = no rows (genuine 404); anything else is a real failure, not "not found".
      throw new InternalServerErrorException(`Failed to load post: ${error.message}`);
    }
    const row = data as { slug: string; status: string; published_at: string | null } | null;
    if (!row) throw new BadRequestException('Post not found');
    return { slug: row.slug, status: row.status, publishedAt: row.published_at };
  }

  private async resolveKeywordText(keywordIds: string[]): Promise<string> {
    if (keywordIds.length === 0) return '';
    const { data } = await this.supabase.from('keywords').select('name').in('id', keywordIds);
    return ((data ?? []) as { name: string }[])
      .map((k) => k.name)
      .sort()
      .join(' ');
  }

  private async currentKeywordIds(postId: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('blog_post_keywords')
      .select('keyword_id')
      .eq('post_id', postId);
    return ((data ?? []) as { keyword_id: string }[]).map((r) => r.keyword_id);
  }

  private async currentCategoryIds(postId: string): Promise<string[]> {
    const { data } = await this.supabase
      .from('blog_post_categories')
      .select('category_id, is_primary')
      .eq('post_id', postId)
      .order('is_primary', { ascending: false });
    return ((data ?? []) as { category_id: string }[]).map((r) => r.category_id);
  }

  private async currentKeywordText(postId: string): Promise<string> {
    return this.resolveKeywordText(await this.currentKeywordIds(postId));
  }
}

interface VersionSnapshot {
  post: Record<string, unknown> & { id?: string; created_at?: string; updated_at?: string };
  translations: (Record<string, unknown> & {
    search_vector?: unknown;
    created_at?: string;
    updated_at?: string;
  })[];
}

// --- Pure row-shape mappers ---------------------------------------------------

function mapTranslation(t: RawTranslation): BlogTranslation {
  return {
    locale: t.locale,
    title: t.title,
    excerpt: t.excerpt ?? undefined,
    seoTitle: t.seo_title ?? undefined,
    seoDescription: t.seo_description ?? undefined,
    bodyRaw: t.body_raw,
    faq: t.faq ?? undefined,
    readingTime: t.reading_time ?? undefined,
    wordCount: t.word_count ?? undefined,
  };
}

function mapCategory(link: RawCategoryLink): BlogCategory {
  const c = firstOf(link.categories);
  return {
    id: c?.id ?? '',
    slug: c?.slug ?? '',
    name: c?.name ?? '',
    parentId: c?.parent_id ?? undefined,
    isPrimary: link.is_primary,
  };
}

function mapKeyword(k: RawKeyword): BlogKeyword {
  return { id: k.id, slug: k.slug, name: k.name };
}

// --- Raw (PostgREST) row shapes for the joined select -------------------------

interface RawTranslation {
  locale: string;
  title: string;
  excerpt: string | null;
  seo_title: string | null;
  seo_description: string | null;
  body_raw: string;
  faq: unknown;
  reading_time: string | null;
  word_count: number | null;
}
interface RawCategory {
  id: string;
  slug: string;
  name: string;
  parent_id: string | null;
}
interface RawCategoryLink {
  is_primary: boolean;
  categories: RawCategory | RawCategory[] | null;
}
interface RawKeyword {
  id: string;
  slug: string;
  name: string;
}
interface RawKeywordLink {
  keywords: RawKeyword | RawKeyword[] | null;
}
interface RawGuide {
  difficulty: string | null;
  meta: Record<string, unknown> | null;
}
interface RawMaintenance {
  make: string | null;
  model: string | null;
  variant: string | null;
  dataset_models: string[] | null;
  applicable_models: string[] | null;
  meta: Record<string, unknown> | null;
}
interface RawTrip {
  distance_km: number | null;
  country_codes: string[] | null;
  route_gpx: string | null;
  meta: Record<string, unknown> | null;
}
interface RawGear {
  brand: string | null;
  model: string | null;
  rating: number | null;
  price_eur: number | null;
  verdict: string | null;
  meta: Record<string, unknown> | null;
}
interface RawVersionRow {
  version_num: number;
  created_by: string | null;
  created_at: string;
  snapshot: {
    post?: { status?: unknown } | null;
    translations?: { locale?: string; title?: unknown }[];
  } | null;
}
interface RawPostRow {
  id: string;
  type: string;
  slug: string;
  status: string;
  published_at: string | null;
  scheduled_for: string | null;
  author: string | null;
  cover_image: string | null;
  cover_alt: string | null;
  spec_data: boolean;
  is_safety_critical: boolean;
  created_at: string;
  updated_at: string;
  blog_post_translations: RawTranslation[] | null;
  blog_post_categories: RawCategoryLink[] | null;
  blog_post_keywords: RawKeywordLink[] | null;
  blog_post_guide: RawGuide | RawGuide[] | null;
  blog_post_maintenance: RawMaintenance | RawMaintenance[] | null;
  blog_post_trip: RawTrip | RawTrip[] | null;
  blog_post_gear: RawGear | RawGear[] | null;
}
