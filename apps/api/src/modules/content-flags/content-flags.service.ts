import { Inject, Injectable } from '@nestjs/common';
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

    if (error || !data) throw new Error('Failed to create flag');
    return {
      id: data.id,
      articleId: data.article_id,
      userId: data.user_id,
      sectionReference: data.section_reference,
      comment: data.comment,
      status: data.status,
      createdAt: data.created_at,
    };
  }
}
