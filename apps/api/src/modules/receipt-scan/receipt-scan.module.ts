import { Module } from '@nestjs/common';
import { ExpensesModule } from '../expenses/expenses.module';
import { MaintenanceTasksModule } from '../maintenance-tasks/maintenance-tasks.module';
import { MotorcyclesModule } from '../motorcycles/motorcycles.module';
import { ReceiptScanResolver } from './receipt-scan.resolver';
import { ReceiptScanService } from './receipt-scan.service';
import { ReceiptScanAiService } from './receipt-scan-ai.service';

// AiBudgetModule and SupabaseModule (SUPABASE_ADMIN) are @Global(); ConfigModule
// is global. The write-path modules (U7b saga: expenses/maintenance/motorcycles)
// export their services and are imported for the transactional save + undo.
@Module({
  imports: [ExpensesModule, MaintenanceTasksModule, MotorcyclesModule],
  providers: [ReceiptScanResolver, ReceiptScanService, ReceiptScanAiService],
})
export class ReceiptScanModule {}
