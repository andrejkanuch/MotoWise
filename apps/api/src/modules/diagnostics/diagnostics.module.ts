import { Module } from '@nestjs/common';
import { DiagnosticsResolver } from './diagnostics.resolver';
import { DiagnosticsService } from './diagnostics.service';

@Module({
  providers: [DiagnosticsResolver, DiagnosticsService],
})
export class DiagnosticsModule {}
