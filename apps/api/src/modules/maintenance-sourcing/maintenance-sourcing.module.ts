import { Module } from '@nestjs/common';
import { MaintenanceSourcingService } from './maintenance-sourcing.service';

/**
 * Maintenance-sourcing module (plan U2).
 *
 * Developer-run extraction-to-draft persistence — no resolver (this is NOT a user GraphQL
 * endpoint). SUPABASE_ADMIN is provided by the @Global() SupabaseModule, so it needs no local
 * provider registration (same pattern as oem-schedules.module.ts).
 */
@Module({
  providers: [MaintenanceSourcingService],
  exports: [MaintenanceSourcingService],
})
export class MaintenanceSourcingModule {}
