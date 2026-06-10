import type { Tables } from '@motovault/types/database';
import {
  BadRequestException,
  Inject,
  Injectable,
  InternalServerErrorException,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { buildConnection, decodeCursor, encodeCursor } from '../../common/pagination/connection';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import type { Article } from './models/article.model';
import { ArticleConnection } from './models/article-connection.model';

@Injectable()
export class ArticlesService {
  private readonly logger = new Logger(ArticlesService.name);

  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  async search(input: {
    query?: string;
    category?: string;
    difficulty?: string;
    first?: number;
    after?: string;
  }): Promise<ArticleConnection> {
    const limit = input.first ?? 20;
    let query = this.adminClient
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
      const decoded = decodeCursor(input.after);
      if (!decoded) {
        throw new BadRequestException('Invalid cursor');
      }
      query = query.lt('generated_at', decoded[0]);
    }

    const { data, count, error } = await query;
    if (error) throw new InternalServerErrorException('Failed to search articles');

    return buildConnection({
      rows: data ?? [],
      limit,
      mapNode: (row) => this.mapRow(row),
      cursorOf: (row) => encodeCursor(row.generated_at),
      totalCount: count ?? 0,
      hasPreviousPage: !!input.after,
    });
  }

  async findBySlug(slug: string): Promise<Article | null> {
    // maybeSingle(): 0 rows is a legitimate "not found" (returns null), while a
    // real DB error is logged and rethrown rather than masked as a 404.
    const { data, error } = await this.adminClient
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_hidden', false)
      .maybeSingle();

    if (error) {
      this.logger.error(`findBySlug failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch article');
    }
    if (!data) return null;

    // Fire-and-forget view count increment
    this.adminClient
      .rpc('increment_article_view_count', { p_article_id: data.id })
      .then(({ error: rpcErr }) => {
        if (rpcErr) this.logger.error('Failed to increment view count', rpcErr);
      });

    return this.mapRow(data);
  }

  async findBySlugFull(slug: string): Promise<Article | null> {
    const { data, error } = await this.adminClient
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_hidden', false)
      .maybeSingle();

    if (error) {
      this.logger.error(`findBySlugFull failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to fetch article');
    }
    if (!data) return null;

    // Fire-and-forget view count increment
    this.adminClient
      .rpc('increment_article_view_count', { p_article_id: data.id })
      .then(({ error: rpcErr }) => {
        if (rpcErr) this.logger.error('Failed to increment view count', rpcErr);
      });

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
    const { data, error } = await this.adminClient
      .from('articles')
      .select(
        'id, slug, title, difficulty, category, view_count, is_safety_critical, generated_at, updated_at, content_json, read_time_minutes, keywords',
      )
      .eq('is_hidden', false)
      .order('view_count', { ascending: false })
      .limit(limit);
    if (error) {
      this.logger.error('Failed to fetch popular articles', error);
      return [];
    }
    return (data ?? []).map((row) => this.mapRow(row));
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
