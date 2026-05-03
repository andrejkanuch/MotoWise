import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';

export interface AuthUser {
  id: string;
  email: string;
  /**
   * INFORMATIONAL ONLY — sourced from JWT claims (app_metadata.role or user_role).
   * Do NOT use this for authorization decisions. All access control must go through
   * Supabase RLS policies or a direct DB query on public.users.role.
   * See: CLAUDE.md "Do NOT use raw_user_meta_data for role checks"
   */
  role: string;
  /**
   * Effective subscription tier, resolved per-request from DB.
   * Computed from subscription_tier + subscription_status + subscription_expires_at.
   * Used by EntitlementsService.can() via GATING_MATRIX.
   * Defaults to 'free' for unauthenticated users or when DB lookup fails.
   */
  tier: 'anonymous' | 'free' | 'pro';
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
