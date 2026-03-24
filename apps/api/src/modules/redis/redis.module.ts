import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Redis } from '@upstash/redis';
import { REDIS } from './redis.constants';

@Global()
@Module({
  providers: [
    {
      provide: REDIS,
      inject: [ConfigService],
      useFactory: (config: ConfigService) => {
        const url = config.get<string>('UPSTASH_REDIS_REST_URL');
        const token = config.get<string>('UPSTASH_REDIS_REST_TOKEN');

        if (!url || !token) {
          return null;
        }

        return new Redis({ url, token });
      },
    },
  ],
  exports: [REDIS],
})
export class RedisModule {}
