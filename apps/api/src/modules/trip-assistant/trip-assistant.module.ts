import { Module } from '@nestjs/common';
import { AiBudgetModule } from '../ai-budget/ai-budget.module';
import { SupabaseModule } from '../supabase/supabase.module';
import { TripAssistantResolver } from './trip-assistant.resolver';
import { TripAssistantService } from './trip-assistant.service';

@Module({
  imports: [AiBudgetModule, SupabaseModule],
  providers: [TripAssistantResolver, TripAssistantService],
})
export class TripAssistantModule {}
