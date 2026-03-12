import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import type { SupabaseClient } from '@supabase/supabase-js';

@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    @Inject('SUPABASE_ADMIN') private supabaseAdmin: SupabaseClient,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 250 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 512 * 1024 * 1024),
      async () => {
        const { error } = await this.supabaseAdmin.from('users').select('id').limit(1);
        if (error) throw new Error(`Supabase unreachable: ${error.message}`);
        return { supabase: { status: 'up' } };
      },
    ]);
  }
}
