import { UserPreferencesSchema } from '@motolearn/types';
import type { Tables } from '@motolearn/types/database';
import {
  BadRequestException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
  TooManyRequestsException,
} from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { CompleteOnboardingInput } from './dto/complete-onboarding.input';
import { DataExportRequest } from './models/data-export-request.model';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
  ) {}

  private mapRow(row: Tables<'users'>): User {
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? undefined,
      role: row.role,
      preferences: (row.preferences as Record<string, unknown>) ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  async findById(id: string): Promise<User> {
    const { data, error } = await this.supabase.from('users').select('*').eq('id', id).single();

    if (error || !data) {
      this.logger.error(`findById failed — id: ${id}, error: ${JSON.stringify(error)}`);
      throw new NotFoundException('User not found');
    }
    return this.mapRow(data);
  }

  async update(
    id: string,
    input: Partial<{
      fullName: string;
      avatarUrl: string;
      yearsRiding: number;
      preferences: Record<string, unknown>;
    }>,
  ): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.yearsRiding !== undefined) payload.years_riding = input.yearsRiding;

    if (input.preferences) {
      const result = UserPreferencesSchema.safeParse(input.preferences);
      if (!result.success) {
        throw new BadRequestException(result.error.flatten().fieldErrors);
      }
      const validatedPrefs = result.data;

      const { data: current } = await this.supabase
        .from('users')
        .select('preferences')
        .eq('id', id)
        .single();

      payload.preferences = {
        ...((current?.preferences as object) ?? {}),
        ...validatedPrefs,
      };
    }

    const { data, error } = await this.supabase
      .from('users')
      .update(payload)
      .eq('id', id)
      .select()
      .single();

    if (error || !data) throw new BadRequestException(error?.message ?? 'Failed to update user');
    return this.mapRow(data);
  }

  async completeOnboarding(userId: string, input: CompleteOnboardingInput): Promise<User> {
    const preferences = {
      onboardingCompleted: true,
      experienceLevel: input.experienceLevel,
      ridingGoals: input.ridingGoals,
      ...(input.ridingFrequency && { ridingFrequency: input.ridingFrequency }),
      ...(input.maintenanceStyle && { maintenanceStyle: input.maintenanceStyle }),
      learningFormats: input.learningFormats,
      ...(input.annualRepairSpend && { annualRepairSpend: input.annualRepairSpend }),
      ...(input.reminderChannel && { reminderChannel: input.reminderChannel }),
      ...(input.lastServiceDate && { lastServiceDate: input.lastServiceDate }),
      maintenanceReminders: input.maintenanceReminders ?? true,
      seasonalTips: input.seasonalTips ?? false,
      recallAlerts: input.recallAlerts ?? false,
      weeklySummary: input.weeklySummary ?? false,
    };

    const { error } = await this.supabase.rpc('complete_onboarding', {
      p_user_id: userId,
      p_preferences: preferences,
      p_bike_make: input.bikeMake ?? null,
      p_bike_model: input.bikeModel ?? null,
      p_bike_year: input.bikeYear ?? null,
      p_bike_type: input.bikeType ?? null,
      p_bike_mileage: input.bikeMileage ?? null,
      p_bike_nickname: input.bikeNickname ?? null,
    });

    if (error) {
      this.logger.error(`completeOnboarding failed: ${JSON.stringify(error)}`);
      throw new BadRequestException(error.message ?? 'Failed to complete onboarding');
    }

    return this.findById(userId);
  }

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
      throw new TooManyRequestsException('You can only request a data export once every 24 hours');
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
      const [
        profileResult,
        motorcyclesResult,
        maintenanceResult,
        diagnosticsResult,
        progressResult,
        quizAttemptsResult,
      ] = await Promise.all([
        this.supabaseAdmin.from('users').select('*').eq('id', userId).single(),
        this.supabaseAdmin.from('motorcycles').select('*').eq('user_id', userId),
        this.supabaseAdmin.from('maintenance_tasks').select('*').eq('user_id', userId),
        this.supabaseAdmin.from('diagnostics').select('*').eq('user_id', userId),
        this.supabaseAdmin.from('learning_progress').select('*').eq('user_id', userId),
        this.supabaseAdmin.from('quiz_attempts').select('*').eq('user_id', userId),
      ]);

      // Also fetch expenses if table exists
      const expensesResult = await this.supabaseAdmin
        .from('expenses')
        .select('*')
        .eq('user_id', userId)
        .then((r) => r)
        .catch(() => ({ data: null, error: null }));

      const exportData = {
        exportedAt: new Date().toISOString(),
        profile: profileResult.data ?? null,
        motorcycles: motorcyclesResult.data ?? [],
        maintenanceTasks: maintenanceResult.data ?? [],
        diagnostics: diagnosticsResult.data ?? [],
        learningProgress: progressResult.data ?? [],
        quizAttempts: quizAttemptsResult.data ?? [],
        expenses: expensesResult.data ?? [],
      };

      // Store export as JSON in Supabase Storage
      const fileName = `exports/${userId}/${exportId}.json`;
      const { error: uploadError } = await this.supabaseAdmin.storage
        .from('user-exports')
        .upload(fileName, JSON.stringify(exportData, null, 2), {
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

      // TODO: Send email with download link to user's email address
      // This requires an email service (e.g. Resend, SendGrid) to be configured
      this.logger.log(
        `Data export ${exportId} completed for user ${userId}. Email to ${email} pending email service setup.`,
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

  async deleteAccount(userId: string, email: string): Promise<boolean> {
    // Call the soft_delete_user RPC (uses auth.uid() check via user's JWT)
    const { error } = await this.supabase.rpc('soft_delete_user', {
      p_user_id: userId,
    });

    if (error) {
      this.logger.error(`deleteAccount soft delete failed for ${userId}: ${JSON.stringify(error)}`);
      throw new BadRequestException(error.message ?? 'Failed to delete account');
    }

    // Try to cancel RevenueCat subscription if configured
    this.cancelRevenueCatSubscription(userId).catch((err) => {
      this.logger.warn(`RevenueCat cancellation failed for ${userId}: ${err.message}`);
    });

    // TODO: Send deletion confirmation email
    this.logger.log(
      `Account ${userId} (${email}) soft-deleted. Scheduled for hard deletion in 30 days.`,
    );

    return true;
  }

  private async cancelRevenueCatSubscription(userId: string): Promise<void> {
    const rcApiKey = process.env.REVENUECAT_API_KEY;
    if (!rcApiKey) {
      this.logger.warn('REVENUECAT_API_KEY not configured — skipping subscription cancellation');
      return;
    }

    try {
      const response = await fetch(`https://api.revenuecat.com/v1/subscribers/${userId}`, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${rcApiKey}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok && response.status !== 404) {
        throw new Error(`RevenueCat API returned ${response.status}`);
      }

      this.logger.log(`RevenueCat subscriber ${userId} deleted`);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unknown error';
      throw new Error(`RevenueCat cancellation failed: ${message}`);
    }
  }
}
