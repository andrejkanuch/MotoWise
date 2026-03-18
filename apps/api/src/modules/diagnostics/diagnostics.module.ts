import { Module } from '@nestjs/common';
import { MaintenanceTasksModule } from '../maintenance-tasks/maintenance-tasks.module';
import { MotorcyclesModule } from '../motorcycles/motorcycles.module';
import { UsersModule } from '../users/users.module';
import { DiagnosticAiService } from './diagnostic-ai.service';
import { DiagnosticsResolver } from './diagnostics.resolver';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  imports: [MotorcyclesModule, UsersModule, MaintenanceTasksModule],
  providers: [DiagnosticsResolver, DiagnosticsService, DiagnosticAiService],
})
export class DiagnosticsModule {}
