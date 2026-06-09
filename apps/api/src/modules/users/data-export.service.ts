import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { QUERY_LIMITS } from '../../config/constants';
import { EmailService } from '../email/email.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { DataExportRequest } from './models/data-export-request.model';

@Injectable()
export class DataExportService {
  private readonly logger = new Logger(DataExportService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly emailService: EmailService,
  ) {}

  async requestDataExport(userId: string, email: string): Promise<DataExportRequest> {
    // Rate limit: 1 export per 24 hours
    const twentyFourHoursAgo = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const { data: recentExports } = await this.supabase
      .from('data_export_requests')
      .select('id')
      .eq('user_id', userId)
      .gte('requested_at', twentyFourHoursAgo)
      .limit(1);

    if (recentExports && recentExports.length > 0) {
      throw new HttpException(
        'You can only request a data export once every 24 hours',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Create export request record
    const { data: exportReq, error } = await this.supabase
      .from('data_export_requests')
      .insert({ user_id: userId, status: 'pending' })
      .select()
      .single();

    if (error || !exportReq) {
      this.logger.error(`requestDataExport insert failed: ${JSON.stringify(error)}`);
      throw new BadRequestException('Failed to create data export request');
    }

    // Compile user data in background (using admin client for cross-table access)
    this.compileAndSendExport(userId, email, exportReq.id).catch((err) => {
      this.logger.error(`compileAndSendExport failed for ${exportReq.id}: ${err.message}`);
    });

    return {
      id: exportReq.id,
      userId: exportReq.user_id,
      status: exportReq.status,
      requestedAt: exportReq.requested_at,
      completedAt: exportReq.completed_at ?? undefined,
      createdAt: exportReq.created_at,
    };
  }

  private async compileAndSendExport(
    userId: string,
    email: string,
    exportId: string,
  ): Promise<void> {
    try {
      // Update status to processing
      await this.supabaseAdmin
        .from('data_export_requests')
        .update({ status: 'processing' })
        .eq('id', exportId);

      // Gather all user data
      const maxRows = QUERY_LIMITS.MAX_EXPORT_ROWS_PER_TABLE;
      const byUserId = (table: string) =>
        this.supabaseAdmin.from(table).select('*').eq('user_id', userId).limit(maxRows);

      const [
        profileResult,
        motorcyclesResult,
        maintenanceResult,
        diagnosticsResult,
        progressResult,
        quizAttemptsResult,
      ] = await Promise.all([
        this.supabaseAdmin.from('users').select('*').eq('id', userId).single(),
        byUserId('motorcycles'),
        byUserId('maintenance_tasks'),
        byUserId('diagnostics'),
        byUserId('learning_progress'),
        byUserId('quiz_attempts'),
      ]);

      const [
        expensesResult,
        ridesResult,
        fuelLogsResult,
        commentsResult,
        rideKudosResult,
        surfaceReportsResult,
      ] = await Promise.all([
        byUserId('expenses'),
        byUserId('rides'),
        byUserId('fuel_logs'),
        byUserId('comments'),
        byUserId('ride_kudos'),
        byUserId('surface_reports'),
      ]);

      const [tripsResult, followsResult] = await Promise.all([
        this.supabaseAdmin.from('trips').select('*').eq('organiser_user_id', userId).limit(maxRows),
        // Both directions: follows the user initiated AND follows of the user
        this.supabaseAdmin
          .from('follows')
          .select('*')
          .or(`follower_id.eq.${userId},following_id.eq.${userId}`)
          .limit(maxRows),
      ]);

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profileResult.data ?? null,
        motorcycles: motorcyclesResult.data ?? [],
        maintenanceTasks: maintenanceResult.data ?? [],
        diagnostics: diagnosticsResult.data ?? [],
        learningProgress: progressResult.data ?? [],
        quizAttempts: quizAttemptsResult.data ?? [],
        expenses: expensesResult.data ?? [],
        rides: ridesResult.data ?? [],
        trips: tripsResult.data ?? [],
        fuelLogs: fuelLogsResult.data ?? [],
        comments: commentsResult.data ?? [],
        follows: followsResult.data ?? [],
        rideKudos: rideKudosResult.data ?? [],
        surfaceReports: surfaceReportsResult.data ?? [],
      };

      // Store export as JSON in Supabase Storage
      const fileName = `exports/${userId}/${exportId}.json`;
      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('user-exports')
        .upload(fileName, JSON.stringify(exportData), {
          contentType: 'application/json',
          upsert: true,
        });

      if (uploadError) {
        throw new Error(`Storage upload failed: ${uploadError.message}`);
      }

      // Generate signed URL (valid for 7 days)
      const { data: signedUrlData } = await this.supabaseAdmin.storage
        .from('user-exports')
        .createSignedUrl(fileName, 7 * 24 * 60 * 60);

      const downloadUrl = signedUrlData?.signedUrl ?? '';

      // Update export record as completed
      await this.supabaseAdmin
        .from('data_export_requests')
        .update({
          status: 'completed',
          completed_at: new Date().toISOString(),
          download_url: downloadUrl,
          expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        })
        .eq('id', exportId);

      // Send email with download link
      await this.emailService.sendDataExportReady(email, downloadUrl);
      this.logger.log(
        `Data export ${exportId} completed for user ${userId}. Email sent to ${email}.`,
      );
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      this.logger.error(`Data export ${exportId} failed: ${message}`);
      await this.supabaseAdmin
        .from('data_export_requests')
        .update({ status: 'failed', error_message: message })
        .eq('id', exportId);
    }
  }
}
