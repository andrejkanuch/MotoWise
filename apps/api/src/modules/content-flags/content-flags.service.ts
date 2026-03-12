import type { Tables } from '@motovault/types/database';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { ContentFlag } from './models/content-flag.model';

@Injectable()
export class ContentFlagsService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async create(
    userId: string,
    input: { articleId: string; sectionReference?: string; comment: string },
  ): Promise<ContentFlag> {
    const { data, error } = await this.supabase
      .from('content_flags')
      .insert({
        user_id: userId,
        article_id: input.articleId,
        section_reference: input.sectionReference,
        comment: input.comment,
      })
      .select()
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to create flag');
    return this.mapRow(data);
  }

  private mapRow(row: Tables<'content_flags'>): ContentFlag {
    return {
      id: row.id,
      articleId: row.article_id,
      userId: row.user_id,
      sectionReference: row.section_reference ?? undefined,
      comment: row.comment,
      status: row.status,
      createdAt: row.created_at,
    };
  }
}
