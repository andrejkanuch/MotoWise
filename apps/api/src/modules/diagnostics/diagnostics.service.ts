import { Inject, Injectable } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Diagnostic } from './models/diagnostic.model';

@Injectable()
export class DiagnosticsService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByUser(userId: string): Promise<Diagnostic[]> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .select('*')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });

    if (error) throw error;
    return (data ?? []).map(this.mapRow);
  }

  async create(
    userId: string,
    input: { motorcycleId: string; wizardAnswers?: string; dataSharingOptedIn: boolean },
  ): Promise<Diagnostic> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId,
        result_json: {},
        wizard_answers: input.wizardAnswers ? JSON.parse(input.wizardAnswers) : null,
        data_sharing_opted_in: input.dataSharingOptedIn,
      })
      .select()
      .single();

    if (error || !data) throw new Error('Failed to create diagnostic');
    return this.mapRow(data);
  }

  private mapRow(row: any): Diagnostic {
    return {
      id: row.id,
      userId: row.user_id,
      motorcycleId: row.motorcycle_id,
      severity: row.severity,
      confidence: row.confidence,
      relatedArticleId: row.related_article_id,
      dataSharingOptedIn: row.data_sharing_opted_in,
      createdAt: row.created_at,
    };
  }
}
