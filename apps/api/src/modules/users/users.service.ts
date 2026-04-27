import {
  RESERVED_HANDLES,
  RESERVED_USERNAMES,
  USERNAME_REGEX,
  UserPreferencesSchema,
} from '@motovault/types';
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
import { MetaEventsService } from '../meta/meta-events.service';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import { RevenueCatService } from '../webhooks/revenuecat.service';
import { DataExportService } from './data-export.service';
import type { CompleteOnboardingInput } from './dto/complete-onboarding.input';
import { DataExportRequest } from './models/data-export-request.model';
import { User } from './models/user.model';

/** Community columns not yet in database.types.ts Tables<'users'> */
interface UserCommunityColumns {
  public_username: string | null;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  is_public: boolean | null;
  follower_count: number | null;
  following_count: number | null;
  avatar_url: string | null;
  handle: string | null;
  show_saved_publicly: boolean | null;
}

/** Shape returned by the public_profiles view */
interface ProfileViewRow {
  id: string;
  public_username: string;
  display_name: string | null;
  bio: string | null;
  city: string | null;
  avatar_url: string | null;
  follower_count: number;
  following_count: number;
}

/** Shape returned by the motorcycles select for profile bikes */
interface ProfileBikeRow {
  make: string;
  model: string;
  year: number;
  nickname: string | null;
}

/** Shape returned by the rides distance select */
interface RideDistanceRow {
  distance_m: number | null;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(
    @Inject(SUPABASE_USER) private readonly supabase: SupabaseClient,
    @Inject(SUPABASE_ADMIN) private readonly supabaseAdmin: SupabaseClient,
    private readonly dataExportService: DataExportService,
    private readonly revenueCatService: RevenueCatService,
    private readonly emailService: EmailService,
    private readonly metaEventsService: MetaEventsService,
  ) {}

  private mapRow(row: Tables<'users'>): User {
    const r = row as unknown as Tables<'users'> & UserCommunityColumns;
    return {
      id: r.id,
      email: r.email,
      fullName: r.full_name ?? undefined,
      role: r.role,
      preferences: (r.preferences as Record<string, unknown>) ?? undefined,
      subscriptionTier: r.subscription_tier ?? undefined,
      measurementSystem: r.measurement_system ?? undefined,
      currency: r.currency,
      publicUsername: r.public_username ?? undefined,
      displayName: r.display_name ?? undefined,
      bio: r.bio ?? undefined,
      city: r.city ?? undefined,
      isPublic: r.is_public ?? undefined,
      followerCount: r.follower_count ?? 0,
      followingCount: r.following_count ?? 0,
      avatarUrl: r.avatar_url ?? undefined,
      handle: r.handle ?? undefined,
      showSavedPublicly: r.show_saved_publicly ?? false,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
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

    const user = await this.findById(userId);

    // Fire Meta CAPI CompleteRegistration — fire and forget, don't block response
    this.metaEventsService
      .sendAppEvent({
        eventName: 'CompleteRegistration',
        userEmail: user.email,
        userId: user.id,
      })
      .catch((err) => {
        this.logger.warn(`Meta CompleteRegistration failed for ${userId}: ${err}`);
      });

    return user;
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

    const p = profile as unknown as ProfileViewRow;

    // Fetch public bikes — use admin client (no user JWT on @Public() route)
    const { data: bikes } = await this.supabaseAdmin
      .from('motorcycles')
      .select('make, model, year, nickname')
      .eq('user_id', p.id)
      .is('deleted_at', null);

    const typedBikes = (bikes ?? []) as unknown as ProfileBikeRow[];

    // Fetch ride stats — admin client, only count public rides
    const { data: rides } = await this.supabaseAdmin
      .from('rides')
      .select('distance_m')
      .eq('user_id', p.id)
      .eq('is_public', true)
      .is('deleted_at', null);

    const typedRides = (rides ?? []) as unknown as RideDistanceRow[];
    const totalRides = typedRides.length;
    const totalDistance = typedRides.reduce((sum, r) => sum + (r.distance_m ?? 0), 0);

    // Check if current user follows this profile
    let isFollowing = false;
    if (currentUserId && currentUserId !== p.id) {
      const { data: follow } = await this.supabase
        .from('follows')
        .select('follower_id')
        .eq('follower_id', currentUserId)
        .eq('following_id', p.id)
        .maybeSingle();
      isFollowing = !!follow;
    }

    return {
      id: p.id,
      publicUsername: p.public_username,
      displayName: p.display_name ?? undefined,
      bio: p.bio ?? undefined,
      city: p.city ?? undefined,
      avatarUrl: p.avatar_url ?? undefined,
      followerCount: p.follower_count ?? 0,
      followingCount: p.following_count ?? 0,
      isFollowing,
      bikes: typedBikes.map((b) => ({
        make: b.make,
        model: b.model,
        year: b.year,
        nickname: b.nickname ?? undefined,
      })),
      rideStats: {
        totalRides,
        totalDistance,
        joinDate: undefined,
      },
    };
  }

  async updateProfile(
    userId: string,
    input: {
      publicUsername?: string;
      displayName?: string;
      bio?: string;
      city?: string;
      isPublic?: boolean;
    },
  ) {
    const updates: Record<string, unknown> = {};

    if (input.publicUsername !== undefined) {
      const username = input.publicUsername.toLowerCase();
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

  async updateHandle(userId: string, handle: string): Promise<User> {
    const normalized = handle.toLowerCase();

    if ((RESERVED_HANDLES as readonly string[]).includes(normalized)) {
      throw new BadRequestException('This handle is reserved');
    }

    // Check uniqueness
    const { data: existing } = await this.supabase
      .from('users')
      .select('id')
      .eq('handle', normalized)
      .neq('id', userId)
      .maybeSingle();

    if (existing) {
      throw new ConflictException('Handle is already taken');
    }

    const { error } = await this.supabase
      .from('users')
      .update({ handle: normalized })
      .eq('id', userId);

    if (error) {
      this.logger.error(`Failed to update handle for ${userId}: ${error.message}`);
      throw new BadRequestException('Failed to update handle');
    }

    return this.findById(userId);
  }
}
