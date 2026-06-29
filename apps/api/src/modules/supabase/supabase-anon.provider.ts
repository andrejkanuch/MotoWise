import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { supabaseRealtimeOptions } from './realtime-transport';

export const SUPABASE_ANON = 'SUPABASE_ANON';

export const supabaseAnonProvider: Provider = {
  provide: SUPABASE_ANON,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): SupabaseClient => {
    return createClient(
      configService.getOrThrow('SUPABASE_URL'),
      configService.getOrThrow('SUPABASE_ANON_KEY'),
      {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
        realtime: supabaseRealtimeOptions,
      },
    );
  },
};
