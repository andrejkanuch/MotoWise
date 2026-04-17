import '../../shared/graphql/enums';
import { Module } from '@nestjs/common';
import { SupabaseModule } from '../supabase/supabase.module';
import { TripSuggestionsResolver } from './trip-suggestions.resolver';
import { TripSuggestionsService } from './trip-suggestions.service';

@Module({
  imports: [SupabaseModule],
  providers: [TripSuggestionsResolver, TripSuggestionsService],
})
export class TripSuggestionsModule {}
