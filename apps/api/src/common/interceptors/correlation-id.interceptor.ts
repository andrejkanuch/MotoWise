import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

const HEADER = 'x-request-id';

/** Log at warn when a GraphQL field takes longer than this (ms). Set SLOW_RESOLVER_MS=0 to disable. */
function slowResolverThresholdMs(): number {
  if (process.env.SLOW_RESOLVER_MS === '0') return Number.POSITIVE_INFINITY;
  const n = Number(process.env.SLOW_RESOLVER_MS ?? 2000);
  return Number.isFinite(n) && n > 0 ? n : 2000;
}

@Injectable()
export class CorrelationIdInterceptor implements NestInterceptor {
  private readonly logger = new Logger('HTTP');

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;

    const requestId = (req.headers[HEADER] as string) || randomUUID();
    req.requestId = requestId;

    // Set response header so clients can correlate
    req.res?.setHeader(HEADER, requestId);

    const info = ctx.getInfo();
    const operationName = info?.fieldName ?? 'unknown';
    const start = Date.now();

    const threshold = slowResolverThresholdMs();

    return next.handle().pipe(
      tap({
        next: () => {
          const duration = Date.now() - start;
          const line = `[${requestId}] ${operationName} ${duration}ms`;
          if (duration >= threshold) {
            this.logger.warn(`SLOW ${line}`);
          } else {
            this.logger.log(line);
          }
        },
        error: (err) => {
          this.logger.error(
            `[${requestId}] ${operationName} ${Date.now() - start}ms — ${err.message ?? err}`,
          );
        },
      }),
    );
  }
}
