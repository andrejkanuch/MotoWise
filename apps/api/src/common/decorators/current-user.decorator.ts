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
}

export const CurrentUser = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthUser => {
    const ctx = GqlExecutionContext.create(context);
    return ctx.getContext().req.user;
  },
);
