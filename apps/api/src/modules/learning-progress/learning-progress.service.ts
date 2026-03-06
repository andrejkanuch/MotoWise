import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { LearningProgress } from './models/learning-progress.model';

@Injectable()
export class LearningProgressService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByUser(userId: string): Promise<LearningProgress[]> {
    const { data, error } = await this.supabase
      .from('learning_progress')
      .select('*')
      .eq('user_id', userId);

    if (error) throw error;
    return (data ?? []).map(this.mapRow);
  }

  async markRead(userId: string, articleId: string): Promise<LearningProgress> {
    const now = new Date().toISOString();
    const { data, error } = await this.supabase
      .from('learning_progress')
      .upsert(
        {
          user_id: userId,
          article_id: articleId,
          article_read: true,
          first_read_at: now,
          last_read_at: now,
        },
        { onConflict: 'user_id,article_id' },
      )
      .select()
      .single();

    if (error || !data) throw new Error('Failed to mark article read');
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
