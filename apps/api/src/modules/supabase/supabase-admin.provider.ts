import { Provider } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createClient, SupabaseClient } from '@supabase/supabase-js';

export const SUPABASE_ADMIN = 'SUPABASE_ADMIN';

export const supabaseAdminProvider: Provider = {
  provide: SUPABASE_ADMIN,
  inject: [ConfigService],
  useFactory: (configService: ConfigService): SupabaseClient => {
    return createClient(
      configService.getOrThrow('SUPABASE_URL'),
      configService.getOrThrow('SUPABASE_SERVICE_ROLE_KEY'),
    );
  },
};
