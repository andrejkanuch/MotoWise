import './common/enums/graphql-enums';
import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule, ThrottlerStorage } from '@nestjs/throttler';
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
import { EmailModule } from './modules/email/email.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { FeedModule } from './modules/feed/feed.module';
import { FuelLogsModule } from './modules/fuel-logs/fuel-logs.module';
import { FollowsModule } from './modules/follows/follows.module';
import { GroupRidesModule } from './modules/group-rides/group-rides.module';
import { HealthModule } from './modules/health/health.module';
import { HealthReportsModule } from './modules/health-reports/health-reports.module';
import { InsightsModule } from './modules/insights/insights.module';
import { KudosModule } from './modules/kudos/kudos.module';
import { LearningProgressModule } from './modules/learning-progress/learning-progress.module';
import { MaintenanceTasksModule } from './modules/maintenance-tasks/maintenance-tasks.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { OemSchedulesModule } from './modules/oem-schedules/oem-schedules.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { RedisModule } from './modules/redis/redis.module';
import { RedisThrottlerStorage } from './modules/redis/redis-throttler.storage';
import { RideSummariesModule } from './modules/ride-summaries/ride-summaries.module';
import { RidesModule } from './modules/rides/rides.module';
import { RoutesModule } from './modules/routes/routes.module';
import { ShareLinksModule } from './modules/share-links/share-links.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
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
    ThrottlerModule.forRoot([
      {
        name: 'default',
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_LIMIT ?? 100),
      },
      {
        name: 'ai',
        ttl: Number(process.env.THROTTLE_TTL ?? 60) * 1000,
        limit: Number(process.env.THROTTLE_AI_LIMIT ?? 10),
      },
    ]),
    EventEmitterModule.forRoot(),
    RedisModule,
    SupabaseModule,
    EmailModule,
    AiBudgetModule,
    AffiliatesModule,
    CommentsModule,
    UsersModule,
    MotorcyclesModule,
    ArticlesModule,
    QuizzesModule,
    DiagnosticsModule,
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
    OemSchedulesModule,
    RideSummariesModule,
    RidesModule,
    RoutesModule,
    ShareLinksModule,
    TripsModule,
    WaitlistModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [
    {
      provide: ThrottlerStorage,
      useClass: RedisThrottlerStorage,
    },
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
