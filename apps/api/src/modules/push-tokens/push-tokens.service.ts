import { Inject, Injectable, InternalServerErrorException, Logger } from '@nestjs/common';
import { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_USER } from '../supabase/supabase-user.provider';

const DEVICE_PUSH_TOKENS_TABLE = 'device_push_tokens';
const CLAIM_DEVICE_PUSH_TOKEN_RPC = 'claim_device_push_token';

@Injectable()
export class PushTokensService {
  private readonly logger = new Logger(PushTokensService.name);

  // User-scoped writes go through the per-request user client: the claim RPC pins
  // the owner to auth.uid() and the delete is filtered by the owner RLS policy.
  constructor(@Inject(SUPABASE_USER) private readonly supabase: SupabaseClient) {}

  // Input is already validated by ZodValidationPipe (platform ∈ {ios, android});
  // the DB CHECK constraint enforces it again at the storage layer.
  async register(userId: string, input: { token: string; platform: string }): Promise<boolean> {
    // A device has one token and shows one account, so the last account to
    // register owns it. A plain upsert cannot take a token over from another
    // account: the owner-only UPDATE policy rejects the conflicting row with 42501
    // (Sentry MOTO-VAULT-NODE-NESTJS-J). The RPC does the takeover with the owner
    // pinned to auth.uid() — see migration 00188.
    const { data, error } = await this.supabase.rpc(CLAIM_DEVICE_PUSH_TOKEN_RPC, {
      p_token: input.token,
      p_platform: input.platform,
    });

    if (error) {
      this.logger.error(`register failed for ${userId}: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to register push token');
    }
    // false = no signed-in user in the database, or a token that is not an Expo push
    // token (the Zod pipe should make both impossible); report it rather than
    // pretend the device is registered.
    if (data !== true) {
      this.logger.warn(`register: claim returned ${String(data)} for ${userId}`);
      return false;
    }
    return true;
  }

  /**
   * Removes this device's token from the caller's account, so a signed-out device
   * stops receiving the account's notifications. Idempotent: a token that is
   * already gone, or now belongs to another account, is not an error.
   */
  async unregister(userId: string, token: string): Promise<boolean> {
    const { error } = await this.supabase
      .from(DEVICE_PUSH_TOKENS_TABLE)
      .delete()
      .eq('token', token)
      .eq('user_id', userId);

    if (error) {
      this.logger.error(`unregister failed for ${userId}: ${error.message} (${error.code})`);
      throw new InternalServerErrorException('Failed to unregister push token');
    }
    return true;
  }
}
