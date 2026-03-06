import { Module } from '@nestjs/common';
import { DiagnosticAiService } from './diagnostic-ai.service';
import { DiagnosticsResolver } from './diagnostics.resolver';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  providers: [DiagnosticsResolver, DiagnosticsService, DiagnosticAiService],
})
export class DiagnosticsModule {}
