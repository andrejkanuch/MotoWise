import './common/enums/graphql-enums';
import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import depthLimit from 'graphql-depth-limit';
import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { GqlThrottlerGuard } from './common/guards/gql-throttler.guard';
import { envSchema } from './config/env.validation';
import { ArticlesModule } from './modules/articles/articles.module';
import { ContentFlagsModule } from './modules/content-flags/content-flags.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { LearningProgressModule } from './modules/learning-progress/learning-progress.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: (config) => envSchema.parse(config),
    }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.graphql'),
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
    UsersModule,
    MotorcyclesModule,
    ArticlesModule,
    QuizzesModule,
    DiagnosticsModule,
    ContentFlagsModule,
    LearningProgressModule,
  ],
  providers: [
    {
      provide: APP_GUARD,
      useClass: GqlThrottlerGuard,
    },
  ],
})
export class AppModule {}
