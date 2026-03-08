import { Provider, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_USER = 'SUPABASE_USER';

// biome-ignore lint/suspicious/noExplicitAny: REQUEST shape varies between HTTP and GraphQL contexts
type RequestContext = any;

export const supabaseUserProvider: Provider = {
  provide: SUPABASE_USER,
  scope: Scope.REQUEST,
  inject: [ConfigService, REQUEST],
  useFactory: (configService: ConfigService, context: RequestContext): SupabaseClient => {
    // In NestJS GraphQL, REQUEST may inject the GqlContext ({ req }) or the raw HTTP request.
    // The access token is set by GqlAuthGuard on the HTTP request object.
    const accessToken = context?.req?.accessToken ?? context?.accessToken;
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
