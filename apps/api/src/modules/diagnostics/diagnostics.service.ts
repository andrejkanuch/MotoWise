import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
import type { Tables } from '@motolearn/types/database';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { Diagnostic } from './models/diagnostic.model';

@Injectable()
export class DiagnosticsService {
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  async findByUser(userId: string): Promise<Diagnostic[]> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .select(
        'id, user_id, motorcycle_id, severity, confidence, related_article_id, data_sharing_opted_in, status, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new InternalServerErrorException('Failed to fetch diagnostics');
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async create(
    userId: string,
    input: {
      motorcycleId: string;
      wizardAnswers?: Record<string, string> | null;
      dataSharingOptedIn: boolean;
    },
  ): Promise<Diagnostic> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId,
        result_json: {},
        wizard_answers: input.wizardAnswers ?? null,
        data_sharing_opted_in: input.dataSharingOptedIn,
      })
      .select()
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to create diagnostic');
    return this.mapRow(data);
  }

  private mapRow(row: Tables<'diagnostics'>): Diagnostic {
    return {
      id: row.id,
      userId: row.user_id,
      motorcycleId: row.motorcycle_id,
      severity: row.severity,
      confidence: row.confidence,
      relatedArticleId: row.related_article_id,
      status: row.status ?? 'pending',
      dataSharingOptedIn: row.data_sharing_opted_in,
      createdAt: row.created_at,
    };
  }
}
