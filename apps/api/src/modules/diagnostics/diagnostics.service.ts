import type { Tables } from '@motovault/types/database';
import { Inject, Injectable, InternalServerErrorException } from '@nestjs/common';
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
        'id, user_id, motorcycle_id, severity, confidence, related_article_id, data_sharing_opted_in, status, urgency, created_at',
      )
      .eq('user_id', userId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw new InternalServerErrorException('Failed to fetch diagnostics');
    return (data ?? []).map((row) => this.mapRow(row));
  }

  async findById(userId: string, diagnosticId: string): Promise<Diagnostic | null> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .select('*')
      .eq('id', diagnosticId)
      .eq('user_id', userId)
      .single();

    if (error || !data) return null;
    return this.mapRowFull(data);
  }

  async create(
    userId: string,
    input: {
      motorcycleId?: string;
      wizardAnswers?: { symptoms?: string; location?: string; timing?: string } | null;
      dataSharingOptedIn: boolean;
      freeTextDescription?: string;
      additionalNotes?: string;
      urgency?: string;
      manualBikeInfo?: { type: string; year?: number; make?: string; model?: string } | null;
    },
  ): Promise<Diagnostic> {
    const { data, error } = await this.supabase
      .from('diagnostics')
      .insert({
        user_id: userId,
        motorcycle_id: input.motorcycleId ?? null,
        result_json: {},
        wizard_answers: input.wizardAnswers ?? null,
        data_sharing_opted_in: input.dataSharingOptedIn,
        free_text_description: input.freeTextDescription ?? null,
        additional_notes: input.additionalNotes ?? null,
        urgency: input.urgency ?? null,
        manual_bike_info: input.manualBikeInfo ?? null,
        status: 'processing',
      })
      .select()
      .single();

    if (error || !data) throw new InternalServerErrorException('Failed to create diagnostic');
    return this.mapRow(data);
  }

  async countUserDiagnosticsThisMonth(userId: string): Promise<number> {
    const monthStart = new Date();
    monthStart.setUTCDate(1);
    monthStart.setUTCHours(0, 0, 0, 0);

    const { count, error } = await this.supabase
      .from('diagnostics')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gte('created_at', monthStart.toISOString());

    if (error) throw new InternalServerErrorException('Failed to count diagnostics');
    return count ?? 0;
  }

  private mapRow(
    row: Pick<
      Tables<'diagnostics'>,
      | 'id'
      | 'user_id'
      | 'motorcycle_id'
      | 'severity'
      | 'confidence'
      | 'related_article_id'
      | 'data_sharing_opted_in'
      | 'status'
      | 'created_at'
    > & { urgency?: string | null },
  ): Diagnostic {
    return {
      id: row.id,
      userId: row.user_id,
      motorcycleId: row.motorcycle_id ?? undefined,
      severity: row.severity ?? undefined,
      confidence: row.confidence ?? undefined,
      relatedArticleId: row.related_article_id ?? undefined,
      status: row.status ?? 'pending',
      dataSharingOptedIn: row.data_sharing_opted_in,
      urgency: row.urgency ?? undefined,
      createdAt: row.created_at,
    };
  }

  private mapRowFull(
    row: Pick<
      Tables<'diagnostics'>,
      | 'id'
      | 'user_id'
      | 'motorcycle_id'
      | 'severity'
      | 'confidence'
      | 'related_article_id'
      | 'data_sharing_opted_in'
      | 'status'
      | 'created_at'
      | 'result_json'
    > & {
      urgency?: string | null;
      free_text_description?: string | null;
      description?: string | null;
      photo_url?: string | null;
    },
  ): Diagnostic {
    return {
      id: row.id,
      userId: row.user_id,
      motorcycleId: row.motorcycle_id ?? undefined,
      severity: row.severity ?? undefined,
      confidence: row.confidence ?? undefined,
      relatedArticleId: row.related_article_id ?? undefined,
      status: row.status ?? 'pending',
      dataSharingOptedIn: row.data_sharing_opted_in,
      urgency: row.urgency ?? undefined,
      createdAt: row.created_at,
      resultJson: row.result_json as Record<string, unknown> | undefined,
      description: row.description ?? undefined,
      photoUrl: row.photo_url ?? undefined,
    };
  }
}
