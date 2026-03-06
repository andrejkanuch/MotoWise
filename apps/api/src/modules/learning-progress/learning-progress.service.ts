import type { Tables } from '@motolearn/types/database';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { LearningProgress } from './models/learning-progress.model';

@Injectable()
export class LearningProgressService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByUser(userId: string): Promise<LearningProgress[]> {
    const { data, error } = await this.supabase
      .from('learning_progress')
      .select(
        'id, user_id, article_id, article_read, quiz_completed, quiz_best_score, first_read_at, last_read_at',
      )
      .eq('user_id', userId)
      .order('last_read_at', { ascending: false })
      .limit(50);

    if (error) throw new InternalServerErrorException('Failed to fetch learning progress');
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async markRead(userId: string, articleId: string): Promise<LearningProgress> {
    const { data, error } = await this.supabase
      .rpc('mark_article_read', { p_user_id: userId, p_article_id: articleId })
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to mark article as read');
    return this.mapRow(data as Tables<'learning_progress'>);
  }

  private mapRow(
    row: Pick<
      Tables<'learning_progress'>,
      | 'id'
      | 'user_id'
      | 'article_id'
      | 'article_read'
      | 'quiz_completed'
      | 'quiz_best_score'
      | 'first_read_at'
      | 'last_read_at'
    >,
  ): LearningProgress {
    return {
      id: row.id,
      userId: row.user_id,
      articleId: row.article_id,
      articleRead: row.article_read,
      quizCompleted: row.quiz_completed,
      quizBestScore: row.quiz_best_score ?? undefined,
      firstReadAt: row.first_read_at ?? undefined,
      lastReadAt: row.last_read_at ?? undefined,
    };
  }
}
