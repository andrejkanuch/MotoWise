import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { SupabaseClient } from '@supabase/supabase-js';
import { SUPABASE_ADMIN } from '../../modules/supabase/supabase-admin.provider';

@Injectable()
export class PremiumGuard implements CanActivate {
  constructor(@Inject(SUPABASE_ADMIN) private readonly adminClient: SupabaseClient) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const gqlContext = GqlExecutionContext.create(context);
    const user = gqlContext.getContext().user;

    // Defensive check — PremiumGuard must run AFTER GqlAuthGuard
    if (!user?.id) {
      throw new UnauthorizedException('Authentication required');
    }

    // Check per-request cache first (avoid duplicate DB queries in same request)
    const req = gqlContext.getContext().req;
    if (req._subscriptionTier !== undefined) {
      if (req._subscriptionTier !== 'pro') {
        throw new ForbiddenException('MotoWise Pro subscription required');
      }
      return true;
    }

    const { data, error } = await this.adminClient
      .from('users')
      .select('subscription_tier')
      .eq('id', user.id)
      .single();

    if (error) {
      throw new InternalServerErrorException('Failed to verify subscription status');
    }

    // Cache on request context for subsequent guards in same request
    req._subscriptionTier = data.subscription_tier;

    if (data.subscription_tier !== 'pro') {
      throw new ForbiddenException('MotoWise Pro subscription required');
    }
    return true;
  }
}
