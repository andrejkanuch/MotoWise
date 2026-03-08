import { Provider, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_USER = 'SUPABASE_USER';

export const supabaseUserProvider: Provider = {
  provide: SUPABASE_USER,
  scope: Scope.REQUEST,
  inject: [ConfigService, REQUEST],
  useFactory: (
    configService: ConfigService,
    // biome-ignore lint/suspicious/noExplicitAny: REQUEST shape varies between HTTP and GraphQL contexts
    context: any,
  ): SupabaseClient => {
    // In NestJS GraphQL, the REQUEST injection gives { req } where req is the
    // raw Express request. Custom properties set by guards (like accessToken)
    // are NOT visible here due to object identity differences. Read the token
    // from the Authorization header directly.
    const req = context?.req ?? context;
    const authHeader: string | undefined = req?.headers?.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    return createClient(
      configService.getOrThrow('SUPABASE_URL'),
      configService.getOrThrow('SUPABASE_ANON_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        global: {
          headers: {
            ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
          },
        },
      },
    );
  },
};
