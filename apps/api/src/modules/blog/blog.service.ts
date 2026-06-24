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
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { ListBlogPostsInput } from './dto/list-blog-posts.input';
import type {
  BlogCategory,
  BlogKeyword,
  BlogPost,
  BlogTranslation,
} from './models/blog-post.model';
import { BlogPostConnection } from './models/blog-post-connection.model';

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

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {
    this.mapRow = this.mapRow.bind(this);
  }

  /** Admin gate — DB role check (the JWT role claim is informational only). */
  private async assertAdmin(userId: string): Promise<void> {
    const { data: caller } = await this.supabase
      .from('users')
      .select('role')
      .eq('id', userId)
      .single();
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
