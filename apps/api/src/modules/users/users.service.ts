import { RESERVED_USERNAMES, USERNAME_REGEX, UserPreferencesSchema } from '@motovault/types';
import type { Tables } from '@motovault/types/database';
import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { SupabaseClient } from '@supabase/supabase-js';
import { EmailService } from '../email/email.service';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { RevenueCatService } from '../webhooks/revenuecat.service';
import { DataExportService } from './data-export.service';
import type { CompleteOnboardingInput } from './dto/complete-onboarding.input';
import { DataExportRequest } from './models/data-export-request.model';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    private readonly dataExportService: DataExportService,
    private readonly revenueCatService: RevenueCatService,
    private readonly emailService: EmailService,
  ) {}

  private mapRow(row: Tables<'users'>): User {
    const r = row as Record<string, unknown>;
    return {
      id: row.id,
      email: row.email,
      fullName: row.full_name ?? undefined,
      role: row.role,
      preferences: (row.preferences as Record<string, unknown>) ?? undefined,
      subscriptionTier: row.subscription_tier ?? undefined,
      measurementSystem: row.measurement_system ?? undefined,
      currency: row.currency,
      publicUsername: (r.public_username as string) ?? undefined,
      displayName: (r.display_name as string) ?? undefined,
      bio: (r.bio as string) ?? undefined,
      city: (r.city as string) ?? undefined,
      isPublic: (r.is_public as boolean) ?? undefined,
      followerCount: (r.follower_count as number) ?? 0,
      followingCount: (r.following_count as number) ?? 0,
      avatarUrl: (r.avatar_url as string) ?? undefined,
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
      measurementSystem: string;
      currency: string;
    }>,
  ): Promise<User> {
    const payload: Record<string, unknown> = {};
    if (input.fullName !== undefined) payload.full_name = input.fullName;
    if (input.avatarUrl !== undefined) payload.avatar_url = input.avatarUrl;
    if (input.yearsRiding !== undefined) payload.years_riding = input.yearsRiding;
    if (input.measurementSystem !== undefined) payload.measurement_system = input.measurementSystem;
    if (input.currency !== undefined) payload.currency = input.currency;

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
      p_bike_photo_url: input.bikePhotoUrl ?? null,
      p_mileage_unit: input.bikeMileageUnit ?? null,
      p_currency: input.currency ?? null,
    });

    if (error) {
      this.logger.error(`completeOnboarding failed: ${JSON.stringify(error)}`);
      throw new BadRequestException(error.message ?? 'Failed to complete onboarding');
    }

    return this.findById(userId);
  }

  async requestDataExport(userId: string, email: string): Promise<DataExportRequest> {
    return this.dataExportService.requestDataExport(userId, email);
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
    this.revenueCatService.cancelSubscription(userId).catch((err) => {
      this.logger.warn(`RevenueCat cancellation failed for ${userId}: ${err.message}`);
    });

    // Send deletion confirmation email (fire and forget)
    this.emailService.sendAccountDeletionConfirmation(email).catch((err) => {
      this.logger.warn(`Deletion confirmation email failed for ${userId}: ${err.message}`);
    });

    this.logger.log(
      `Account ${userId} (${email}) soft-deleted. Scheduled for hard deletion in 30 days.`,
    );

    return true;
  }

  async getRiderProfile(username: string, currentUserId?: string) {
    // Query public_profiles VIEW (only exposes safe columns)
    const { data: profile, error } = await this.supabase
      .from('public_profiles' as never)
      .select('*')
      .eq('public_username', username)
      .single();

    if (error || !profile) {
      throw new NotFoundException('Profile not found');
    }

    const p = profile as Record<string, unknown>;

    // Fetch public bikes
    const { data: bikes } = await this.supabase
      .from('motorcycles')
      .select('make, model, year, nickname')
      .eq('user_id', p.id as string)
      .is('deleted_at', null);

    // Fetch ride stats
    const { data: rides } = await this.supabase
      .from('rides')
      .select('distance_m')
      .eq('user_id', p.id as string)
      .eq('is_public', true)
      .is('deleted_at', null);

    const totalRides = rides?.length ?? 0;
    const totalDistance = rides?.reduce((sum, r) => sum + ((r.distance_m as number) ?? 0), 0) ?? 0;

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUserId && currentUserId !== p.id) {
      const { data: follow } = await this.supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', p.id as string)
        .maybeSingle();
      isFollowing = !!follow;
    }

    return {
      id: p.id as string,
      publicUsername: p.public_username as string,
      displayName: (p.display_name as string) ?? null,
      bio: (p.bio as string) ?? null,
      city: (p.city as string) ?? null,
      avatarUrl: (p.avatar_url as string) ?? null,
      followerCount: (p.follower_count as number) ?? 0,
      followingCount: (p.following_count as number) ?? 0,
      isFollowing,
      bikes: (bikes ?? []).map((b) => ({
        make: b.make as string,
        model: b.model as string,
        year: b.year as number,
        nickname: (b.nickname as string) ?? null,
      })),
      rideStats: {
        totalRides,
        totalDistance,
        joinDate: null,
      },
    };
  }

  async updateProfile(userId: string, input: Record<string, unknown>) {
    const updates: Record<string, unknown> = {};

    if (input.publicUsername !== undefined) {
      const username = (input.publicUsername as string).toLowerCase();
      if (!USERNAME_REGEX.test(username)) {
        throw new BadRequestException(
          'Username must be 3-20 characters, lowercase alphanumeric and underscores only',
        );
      }
      if (RESERVED_USERNAMES.includes(username as never)) {
        throw new BadRequestException('This username is reserved');
      }
      // Check uniqueness
      const { data: existing } = await this.supabase
        .from('users')
        .select('id')
        .eq('public_username', username)
        .neq('id', userId)
        .maybeSingle();
      if (existing) {
        throw new ConflictException('Username is already taken');
      }
      updates.public_username = username;
    }

    if (input.displayName !== undefined) updates.display_name = input.displayName;
    if (input.bio !== undefined) updates.bio = input.bio;
    if (input.city !== undefined) updates.city = input.city;
    if (input.isPublic !== undefined) updates.is_public = input.isPublic;

    if (Object.keys(updates).length === 0) {
      return this.findById(userId);
    }

    const { error } = await this.supabase.from('users').update(updates).eq('id', userId);

    if (error) {
      this.logger.error(`Failed to update profile for ${userId}: ${error.message}`);
      throw new BadRequestException('Failed to update profile');
    }

    return this.findById(userId);
  }
}
