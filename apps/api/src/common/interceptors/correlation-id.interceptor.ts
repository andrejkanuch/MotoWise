import { randomUUID } from 'node:crypto';
import { CallHandler, ExecutionContext, Injectable, Logger, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Observable } from 'rxjs';
import { tap } from 'rxjs';

const HEADER = 'x-request-id';

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

    return next.handle().pipe(
      tap({
        next: () => {
          this.logger.log(`[${requestId}] ${operationName} ${Date.now() - start}ms`);
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
