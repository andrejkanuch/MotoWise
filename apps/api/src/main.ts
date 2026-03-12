import { NestFactory } from '@nestjs/core';
import helmet from 'helmet';
import { AppModule } from './app.module';
import { AllExceptionsFilter } from './common/filters/gql-exception.filter';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Graceful shutdown hooks for SIGTERM/SIGINT
  app.enableShutdownHooks();

  // Trust proxy for correct client IP behind Render's load balancer
  app.getHttpAdapter().getInstance().set('trust proxy', 1);

  app.use(
    helmet({
      contentSecurityPolicy: process.env.NODE_ENV === 'production' ? undefined : false,
    }),
  );

  app.enableCors({
    origin: process.env.CORS_ORIGINS?.split(',') ?? [
      'http://localhost:8081',
      'http://localhost:3000',
    ],
    credentials: true,
  });

  app.useGlobalFilters(new AllExceptionsFilter());

  const port = process.env.PORT ?? 4000;
  await app.listen(port, '0.0.0.0');
  console.log(`API running on http://0.0.0.0:${port}/graphql`);
}
bootstrap();
