import './common/enums/graphql-enums';
import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import depthLimit from 'graphql-depth-limit';
import { AllExceptionsFilter } from './common/filters/gql-exception.filter';
import { GqlAuthGuard } from './common/guards/gql-auth.guard';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { THROTTLE_PRESETS } from './config/constants';
import { envSchema } from './config/env.validation';
import { AffiliatesModule } from './modules/affiliates/affiliates.module';
import { AiBudgetModule } from './modules/ai-budget/ai-budget.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { BlogModule } from './modules/blog/blog.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ContentFlagsModule } from './modules/content-flags/content-flags.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { DocumentsModule } from './modules/documents/documents.module';
import { EmailModule } from './modules/email/email.module';
import { EntitlementsModule } from './modules/entitlements/entitlements.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FeedModule } from './modules/feed/feed.module';
import { FollowsModule } from './modules/follows/follows.module';
import { FuelLogsModule } from './modules/fuel-logs/fuel-logs.module';
import { FuelStopsModule } from './modules/fuel-stops/fuel-stops.module';
import { GroupRidesModule } from './modules/group-rides/group-rides.module';
import { HealthModule } from './modules/health/health.module';
import { HealthReportsModule } from './modules/health-reports/health-reports.module';
import { InsightsModule } from './modules/insights/insights.module';
import { KudosModule } from './modules/kudos/kudos.module';
import { LearningProgressModule } from './modules/learning-progress/learning-progress.module';
import { MaintenanceSourcingModule } from './modules/maintenance-sourcing/maintenance-sourcing.module';
import { MaintenanceTasksModule } from './modules/maintenance-tasks/maintenance-tasks.module';
import { MetaModule } from './modules/meta/meta.module';
import { ModelInsightsModule } from './modules/model-insights/model-insights.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { OemSchedulesModule } from './modules/oem-schedules/oem-schedules.module';
import { PlacesModule } from './modules/places/places.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { RedisModule } from './modules/redis/redis.module';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage';
import { RideAnalyticsModule } from './modules/ride-analytics/ride-analytics.module';
import { RideSummariesModule } from './modules/ride-summaries/ride-summaries.module';
import { RidesModule } from './modules/rides/rides.module';
import { SearchModule } from './modules/search/search.module';
import { ShareLinksModule } from './modules/share-links/share-links.module';
import { SponsorshipsModule } from './modules/sponsorships/sponsorships.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { SurfaceReportsModule } from './modules/surface-reports/surface-reports.module';
import { TripAssistantModule } from './modules/trip-assistant/trip-assistant.module';
import { TripSuggestionsModule } from './modules/trip-suggestions/trip-suggestions.module';
import { TripsModule } from './modules/trips/trips.module';
import { UsersModule } from './modules/users/users.module';
import { WaitlistModule } from './modules/waitlist/waitlist.module';
import { WebhooksModule } from './modules/webhooks/webhooks.module';

@Module({
  imports: [
    SentryModule.forRoot(),
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile:
        process.env.NODE_ENV === 'production' ? true : join(process.cwd(), 'schema.graphql'),
      sortSchema: true,
      playground: process.env.GRAPHQL_PLAYGROUND === 'true',
      introspection: process.env.NODE_ENV !== 'production',
      validationRules: [depthLimit(7)],
    }),
    EventEmitterModule.forRoot(),
    // Selective rate limiting: NO global guard (a global GqlThrottlerGuard caused
    // mass 429s on public SSR — 24d066b5). Expensive resolvers opt in with
    // @UseGuards(GqlThrottlerGuard) + @Throttle({ default: THROTTLE_PRESETS.X }).
    // Exactly ONE named throttler: v6 applies EVERY registered throttler to every
    // guarded route, so multiple named presets would all fire at once.
    ThrottlerModule.forRootAsync({
      imports: [RedisModule],
      inject: [RedisThrottlerStorage],
      useFactory: (storage: RedisThrottlerStorage) => ({
        throttlers: [{ name: 'default', ...THROTTLE_PRESETS.STANDARD }],
        storage,
      }),
    }),
    RedisModule,
    SupabaseModule,
    EmailModule,
    AiBudgetModule,
    AffiliatesModule,
    CommentsModule,
    UsersModule,
    MotorcyclesModule,
    PlacesModule,
    ArticlesModule,
    BlogModule,
    QuizzesModule,
    DiagnosticsModule,
    DocumentsModule,
    ExpensesModule,
    FuelLogsModule,
    FeedModule,
    FollowsModule,
    GroupRidesModule,
    HealthReportsModule,
    InsightsModule,
    KudosModule,
    ContentFlagsModule,
    LearningProgressModule,
    MaintenanceSourcingModule,
    MaintenanceTasksModule,
    MetaModule,
    ModelInsightsModule,
    OemSchedulesModule,
    RideAnalyticsModule,
    RideSummariesModule,
    RidesModule,
    SearchModule,
    EntitlementsModule,
    FuelStopsModule,
    SurfaceReportsModule,
    ShareLinksModule,
    SponsorshipsModule,
    TripsModule,
    TripAssistantModule,
    TripSuggestionsModule,
    WaitlistModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlAuthGuard,
    },
    {
      provide: APP_FILTER,
      useClass: AllExceptionsFilter,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: CorrelationIdInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LocaleInterceptor,
    },
  ],
})
export class AppModule {}
