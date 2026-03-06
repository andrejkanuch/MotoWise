import { join } from 'node:path';
import { ApolloDriver, ApolloDriverConfig } from '@nestjs/apollo';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { ThrottlerModule } from '@nestjs/throttler';
import { ArticlesModule } from './modules/articles/articles.module';
import { AuthModule } from './modules/auth/auth.module';
import { ContentFlagsModule } from './modules/content-flags/content-flags.module';
import { DiagnosticsModule } from './modules/diagnostics/diagnostics.module';
import { LearningProgressModule } from './modules/learning-progress/learning-progress.module';
import { MotorcyclesModule } from './modules/motorcycles/motorcycles.module';
import { QuizzesModule } from './modules/quizzes/quizzes.module';
import { SupabaseModule } from './modules/supabase/supabase.module';
import { UsersModule } from './modules/users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    GraphQLModule.forRoot<ApolloDriverConfig>({
      driver: ApolloDriver,
      autoSchemaFile: join(process.cwd(), 'schema.graphql'),
      sortSchema: true,
      playground: process.env.GRAPHQL_PLAYGROUND === 'true',
      introspection: process.env.NODE_ENV !== 'production',
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
    AuthModule,
    UsersModule,
    MotorcyclesModule,
    ArticlesModule,
    QuizzesModule,
    DiagnosticsModule,
    ContentFlagsModule,
    LearningProgressModule,
  ],
})
export class AppModule {}
