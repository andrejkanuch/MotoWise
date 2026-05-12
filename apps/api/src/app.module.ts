import './common/enums/graphql-enums';
import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryModule } from '@sentry/nestjs/setup';
import depthLimit from 'graphql-depth-limit';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { CorrelationIdInterceptor } from './common/interceptors/correlation-id.interceptor';
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { envSchema } from './config/env.validation';
import { AffiliatesModule } from './modules/affiliates/affiliates.module';
import { AiBudgetModule } from './modules/ai-budget/ai-budget.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { CommentsModule } from './modules/comments/comments.module';
import { ContentFlagsModule } from './modules/content-flags/content-flags.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { DiscoverTripsModule } from './modules/discover-trips/discover-trips.module';
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
import { MaintenanceTasksModule } from './modules/maintenance-tasks/maintenance-tasks.module';
import { MetaModule } from './modules/meta/meta.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { OemSchedulesModule } from './modules/oem-schedules/oem-schedules.module';
import { PlacesModule } from './modules/places/places.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { REDIS } from './modules/redis/redis.constants';
import { RedisModule } from './modules/redis/redis.module';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage';
import { RideSummariesModule } from './modules/ride-summaries/ride-summaries.module';
import { RidesModule } from './modules/rides/rides.module';
import { RoutesModule } from './modules/routes/routes.module';
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
    RedisModule,
    ThrottlerModule.forRootAsync({
      inject: [ConfigService, REDIS],
      useFactory: (config: ConfigService, redis: import('@upstash/redis').Redis | null) => {
        const storage = new RedisThrottlerStorage(redis);
        storage.onModuleInit();
        return {
          throttlers: [
            {
              ttl: config.get<number>('THROTTLE_TTL', 60) * 1000,
              limit: config.get<number>('THROTTLE_LIMIT', 100),
            },
          ],
          storage,
        };
      },
    }),
    SupabaseModule,
    EmailModule,
    AiBudgetModule,
    AffiliatesModule,
    CommentsModule,
    UsersModule,
    MotorcyclesModule,
    PlacesModule,
    ArticlesModule,
    QuizzesModule,
    DiagnosticsModule,
    DiscoverTripsModule,
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
    MaintenanceTasksModule,
    MetaModule,
    OemSchedulesModule,
    RideSummariesModule,
    RidesModule,
    RoutesModule,
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
      useClass: GqlThrottlerGuard,
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
