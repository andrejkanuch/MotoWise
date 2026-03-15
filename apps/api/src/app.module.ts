import './common/enums/graphql-enums';
import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_GUARD, APP_INTERCEPTOR } from '@nestjs/core';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { SentryGlobalFilter, SentryModule } from '@sentry/nestjs/setup';
import depthLimit from 'graphql-depth-limit';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { LocaleInterceptor } from './common/interceptors/locale.interceptor';
import { envSchema } from './config/env.validation';
import { AiBudgetModule } from './modules/ai-budget/ai-budget.module';
import { ArticlesModule } from './modules/articles/articles.module';
import { ContentFlagsModule } from './modules/content-flags/content-flags.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { EmailModule } from './modules/email/email.module';
import { ExpensesModule } from './modules/expenses/expenses.module';
import { HealthModule } from './modules/health/health.module';
import { InsightsModule } from './modules/insights/insights.module';
import { LearningProgressModule } from './modules/learning-progress/learning-progress.module';
import { MaintenanceTasksModule } from './modules/maintenance-tasks/maintenance-tasks.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { OemSchedulesModule } from './modules/oem-schedules/oem-schedules.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { ShareLinksModule } from './modules/share-links/share-links.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
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
    SupabaseModule,
    EmailModule,
    AiBudgetModule,
    UsersModule,
    MotorcyclesModule,
    ArticlesModule,
    QuizzesModule,
    DiagnosticsModule,
    ExpensesModule,
    InsightsModule,
    ContentFlagsModule,
    LearningProgressModule,
    MaintenanceTasksModule,
    OemSchedulesModule,
    ShareLinksModule,
    WaitlistModule,
    WebhooksModule,
    HealthModule,
  ],
  providers: [
    {
      provide: APP_FILTER,
      useClass: SentryGlobalFilter,
    },
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: LocaleInterceptor,
    },
  ],
})
export class AppModule {}
