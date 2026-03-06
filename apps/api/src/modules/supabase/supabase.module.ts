import { Global, Module } from '@nestjs/common';
import { SUPABASE_ADMIN, supabaseAdminProvider } from './supabase-admin.provider';
import { SUPABASE_USER, supabaseUserProvider } from './supabase-user.provider';

@Global()
@Module({
  providers: [supabaseAdminProvider, supabaseUserProvider],
  exports: [SUPABASE_ADMIN, SUPABASE_USER],
})
export class SupabaseModule {}
