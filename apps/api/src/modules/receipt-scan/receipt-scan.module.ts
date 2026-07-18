import { Module } from '@nestjs/common';
import { ReceiptScanResolver } from './receipt-scan.resolver';
import { ReceiptScanService } from './receipt-scan.service';
import { ReceiptScanAiService } from './receipt-scan-ai.service';

// AiBudgetModule and SupabaseModule (SUPABASE_ADMIN) are @Global(); ConfigModule
// is global. No explicit imports needed — mirrors the diagnostics module shape.
@Module({
  providers: [ReceiptScanResolver, ReceiptScanService, ReceiptScanAiService],
})
export class ReceiptScanModule {}
