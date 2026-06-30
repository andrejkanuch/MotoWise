import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';

@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  // User-scoped writes go through the per-request user client so RLS enforces
  // that a caller can only register a token under their own user_id.
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  // Input is already validated by ZodValidationPipe (platform ∈ {ios, android});
  // the DB CHECK constraint enforces it again at the storage layer.
  async register(userId: string, input: { token: string; platform: string }): Promise<boolean> {
    // Upsert on the unique token: re-registration from the same device refreshes
    // ownership + last_seen_at rather than creating duplicates.
    const { error } = await this.supabase.from('device_push_tokens').upsert(
      {
        user_id: userId,
        token: input.token,
        platform: input.platform,
        last_seen_at: new Date().toISOString(),
      },
      { onConflict: 'token' },
    );

    if (error) {
      this.logger.error(`register failed: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to register push token');
    }
    return true;
  }
}
