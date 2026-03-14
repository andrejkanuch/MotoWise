import type { Tables } from '@motovault/types/database';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_ANON } from '../supabase/supabase-anon.provider';
import type { Article } from './models/article.model';
import { ArticleConnection } from './models/article-connection.model';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(
    @Inject(SUPABASE_ANON) private readonly anonClient: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient,
  ) {}

  async search(input: {
    query?: string;
    category?: string;
    difficulty?: string;
    first?: number;
    after?: string;
  }): Promise<ArticleConnection> {
    const limit = input.first ?? 20;
    let query = this.anonClient
      .from('articles')
      .select(
        'id, slug, title, difficulty, category, view_count, is_safety_critical, generated_at, updated_at',
        { count: 'exact' },
      )
      .eq('is_hidden', false)
      .order('generated_at', { ascending: false })
      .limit(limit + 1);

    if (input.category) query = query.eq('category', input.category);
    if (input.difficulty) query = query.eq('difficulty', input.difficulty);
    if (input.query) {
      query = query.textSearch('search_vector', input.query, { type: 'websearch' });
    }
    if (input.after) {
      const cursorDate = Buffer.from(input.after, 'base64').toString('utf-8');
      if (Number.isNaN(Date.parse(cursorDate))) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('generated_at', cursorDate);
    }

    const { data, count, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to search articles');

    const hasNextPage = (data?.length ?? 0) > limit;
    const rows = hasNextPage ? data?.slice(0, limit) : (data ?? []);

    const edges = rows.map((row) => ({
      node: this.mapRow(row),
      cursor: Buffer.from(row.generated_at).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage,
        hasPreviousPage: !!input.after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: count ?? 0,
    };
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const { data, error } = await this.anonClient
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_hidden', false)
      .single();

    if (error || !data) return null;

    // Fire-and-forget view count increment
    this.anonClient.rpc('increment_article_view_count', { p_article_id: data.id }).then();

    return this.mapRow(data);
  }

  async findBySlugFull(slug: string): Promise<Article | null> {
    const { data, error } = await this.anonClient
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_hidden', false)
      .single();

    if (error || !data) return null;

    // Fire-and-forget view count increment
    this.anonClient.rpc('increment_article_view_count', { p_article_id: data.id }).then();

    return this.mapRowFull(data);
  }

  async findSimilar(topic: string): Promise<{ title: string; slug: string }[]> {
    const searchTerm = topic.trim().split(/\s+/).slice(0, 5).join(' & ');
    const { data } = await this.adminClient
      .from('articles')
      .select('title, slug')
      .textSearch('search_vector', searchTerm, { type: 'websearch' })
      .limit(3);
    return data ?? [];
  }

  async findPopular(first = 10): Promise<Article[]> {
    const limit = Math.min(Math.max(first, 1), 20);
    const { data, error } = await this.anonClient
      .from('articles')
      .select(
        'id, slug, title, difficulty, category, view_count, is_safety_critical, generated_at, updated_at, read_time_minutes, keywords',
      )
      .eq('is_hidden', false)
      .order('view_count', { ascending: false })
      .limit(limit);

    if (error) {
      this.logger.error('Failed to fetch popular articles', error);
      return [];
    }
    // biome-ignore lint/suspicious/noExplicitAny: keywords not in generated DB types yet
    return (data ?? []).map((row) => this.mapRow(row as any));
  }

  mapRow(
    row: Pick<
      Tables<'articles'>,
      | 'id'
      | 'slug'
      | 'title'
      | 'difficulty'
      | 'category'
      | 'view_count'
      | 'is_safety_critical'
      | 'generated_at'
      | 'updated_at'
    > & { keywords?: string[] },
  ): Article {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      category: row.category,
      viewCount: row.view_count,
      isSafetyCritical: row.is_safety_critical,
      generatedAt: row.generated_at,
      updatedAt: row.updated_at,
      keywords: row.keywords ?? undefined,
    };
  }

  private mapRowFull(
    row: Pick<
      Tables<'articles'>,
      | 'id'
      | 'slug'
      | 'title'
      | 'difficulty'
      | 'category'
      | 'view_count'
      | 'is_safety_critical'
      | 'generated_at'
      | 'updated_at'
      | 'content_json'
      | 'read_time_minutes'
    > & { keywords?: string[] },
  ): Article {
    return {
      id: row.id,
      slug: row.slug,
      title: row.title,
      difficulty: row.difficulty,
      category: row.category,
      viewCount: row.view_count,
      isSafetyCritical: row.is_safety_critical,
      generatedAt: row.generated_at,
      updatedAt: row.updated_at,
      contentJson: row.content_json as Record<string, unknown> | undefined,
      readTime: row.read_time_minutes ?? undefined,
      keywords: row.keywords ?? undefined,
    };
  }
}
