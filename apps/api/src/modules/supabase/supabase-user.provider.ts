import { Provider, Scope } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { REQUEST } from '@nestjs/core';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_USER = 'SUPABASE_USER';

interface AuthenticatedRequest {
  accessToken?: string;
}

export const supabaseUserProvider: Provider = {
  provide: SUPABASE_USER,
  scope: Scope.REQUEST,
  inject: [ConfigService, REQUEST],
  useFactory: (configService: ConfigService, request: AuthenticatedRequest): SupabaseClient => {
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
            Authorization: `Bearer ${request.accessToken}`,
          },
        },
      },
    );
  },
};
