import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { Article } from './models/article.model';
import { ArticleConnection } from './models/article-connection.model';

@Injectable()
export class ArticlesService {
  constructor(@Inject(SUPABASE_ADMIN) private readonly supabase: SupabaseClient) {}

  async search(input: {
    query?: string;
    category?: string;
    difficulty?: string;
    first?: number;
    after?: string;
  }): Promise<ArticleConnection> {
    let query = this.supabase
      .from('articles')
      .select('*', { count: 'exact' })
      .eq('is_hidden', false)
      .order('generated_at', { ascending: false })
      .limit(input.first ?? 20);

    if (input.category) query = query.eq('category', input.category);
    if (input.difficulty) query = query.eq('difficulty', input.difficulty);

    const { data, count, error } = await query;
    if (error) throw error;

    const edges = (data ?? []).map((row) => ({
      node: this.mapRow(row),
      cursor: Buffer.from(row.id).toString('base64'),
    }));

    return {
      edges,
      pageInfo: {
        hasNextPage: (data?.length ?? 0) === (input.first ?? 20),
        hasPreviousPage: !!input.after,
        startCursor: edges[0]?.cursor,
        endCursor: edges[edges.length - 1]?.cursor,
      },
      totalCount: count ?? 0,
    };
  }

  async findBySlug(slug: string): Promise<Article | null> {
    const { data, error } = await this.supabase
      .from('articles')
      .select('*')
      .eq('slug', slug)
      .eq('is_hidden', false)
      .single();

    if (error || !data) return null;
    return this.mapRow(data);
  }

  private mapRow(row: any): Article {
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
    };
  }
}
