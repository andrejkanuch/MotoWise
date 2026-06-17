import { Controller, Get, Inject } from '@nestjs/common';
import { HealthCheck, HealthCheckService, MemoryHealthIndicator } from '@nestjs/terminus';
import type { SupabaseClient } from '@supabase/supabase-js';
import { Public } from '../../common/decorators/public.decorator';
import { SUPABASE_ADMIN } from '../supabase/supabase-admin.provider';

@Public()
@Controller('health')
export class HealthController {
  constructor(
    private health: HealthCheckService,
    private memory: MemoryHealthIndicator,
    @Inject(SUPABASE_ADMIN) private supabaseAdmin: SupabaseClient,
  ) {}

  /**
   * Liveness — this is Render's `healthCheckPath`. It confirms ONLY that the
   * process is up and the event loop is responsive. It deliberately has no DB
   * dependency and no tight memory gates.
   *
   * Rationale: the previous check failed on any Supabase blip and once RSS hit
   * 512MB (the Starter container ceiling) / heap hit 250MB. On a single
   * instance, a failing health check (or the OOM it foreshadows) makes Render
   * restart the only instance — turning a transient DB hiccup or a brief memory
   * spike into a ~45s full outage (Sentry MOTOVAULT-WEB-N: 107 errors in one
   * 44s window, plus mobile 504/abort/cancelled). A liveness probe must not
   * couple the app's "should I be restarted?" signal to an external dependency.
   */
  @Get()
  live() {
    return { status: 'ok' };
  }

  /**
   * Deep readiness — for dashboards, uptime probes, and manual diagnosis. NOT
   * wired to Render's healthCheckPath, so a failure here surfaces a real problem
   * (DB unreachable, memory pressure) WITHOUT triggering an instance restart.
   * Heap/RSS thresholds sit below the container ceiling as early-warning levels.
   */
  @Get('deep')
  @HealthCheck()
  deep() {
    return this.health.check([
      () => this.memory.checkHeap('memory_heap', 400 * 1024 * 1024),
      () => this.memory.checkRSS('memory_rss', 480 * 1024 * 1024),
      async () => {
        const { error } = await this.supabaseAdmin.from('users').select('id').limit(1);
        if (error) throw new Error(`Supabase unreachable: ${error.message}`);
        return { supabase: { status: 'up' } };
      },
    ]);
  }
}
