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
    const req = context?.req ?? context;
    const authHeader: string | undefined = req?.headers?.authorization;
    const accessToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;

    return createClient(
      configService.getOrThrow('SUPABASE_URL'),
      configService.getOrThrow('SUPABASE_ANON_KEY'),
      {
        global: {
          headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
        },
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      },
    );
  },
};
