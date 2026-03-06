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
    const now = new Date().toISOString();

    // Upsert without first_read_at to avoid overwriting it on conflict.
    // On INSERT the column stays NULL; on UPDATE (conflict) it is untouched.
    const { data, error } = await this.supabase
      .from('learning_progress')
      .upsert(
        {
          user_id: userId,
          article_id: articleId,
          article_read: true,
          last_read_at: now,
        },
        { onConflict: 'user_id,article_id' },
      )
      .select()
      .single();

    if (error || !data)
      throw new InternalServerErrorException('Failed to update learning progress');

    // For newly-inserted rows first_read_at will be NULL — set it once.
    if (!data.first_read_at) {
      const { data: updated, error: updateError } = await this.supabase
        .from('learning_progress')
        .update({ first_read_at: now })
        .eq('user_id', userId)
        .eq('article_id', articleId)
        .is('first_read_at', null)
        .select()
        .single();

      if (updateError || !updated)
        throw new InternalServerErrorException('Failed to update learning progress');
      return this.mapRow(updated);
    }

    return this.mapRow(data);
  }

  private mapRow(row: any): LearningProgress {
    return {
      id: row.id,
      userId: row.user_id,
      articleId: row.article_id,
      articleRead: row.article_read,
      quizCompleted: row.quiz_completed,
      quizBestScore: row.quiz_best_score,
      firstReadAt: row.first_read_at,
      lastReadAt: row.last_read_at,
    };
  }
}
