import { Module } from '@nestjs/common';
import { MotorcyclesModule } from '../motorcycles/motorcycles.module';
import { DiagnosticAiService } from './diagnostic-ai.service';
import { DiagnosticsResolver } from './diagnostics.resolver';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  imports: [MotorcyclesModule],
  providers: [DiagnosticsResolver, DiagnosticsService, DiagnosticAiService],
})
export class DiagnosticsModule {}
