import { UserPreferencesSchema } from '@motovault/types';
import type { Tables } from '@motovault/types/database';
import { BadRequestException, Inject, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';
import type { CompleteOnboardingInput } from './dto/complete-onboarding.input';
import { User } from './models/user.model';

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

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
}
