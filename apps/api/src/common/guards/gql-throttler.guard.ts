import { ExecutionContext, Injectable } from '@nestjs/common';
import { GqlContextType, GqlExecutionContext } from '@nestjs/graphql';
import { ThrottlerGuard } from '@nestjs/throttler';

/**
 * Context-aware throttler guard, applied PER RESOLVER via @UseGuards — never as a
 * global APP_GUARD. The previous global registration was removed in 24d066b5 because
 * v6's @SkipThrottle() only skips the throttler literally named `default`, which
 * 429'd the public SSR browse queries. Opt-in per resolver needs no skip decorators.
 *
 * Exactly ONE throttler (named `default`) is registered in AppModule: the v6 guard
 * loops over every registered named throttler and applies its module-level limit to
 * any guarded route lacking a matching @Throttle entry — multiple named presets
 * would all fire on every guarded resolver.
 */
@Injectable()
export class GqlThrottlerGuard extends ThrottlerGuard {
  // Must stay SYNC: v6's handleRequest destructures the return value without await.
  getRequestResponse(context: ExecutionContext) {
    if (context.getType<GqlContextType>() === 'graphql') {
      const ctx = GqlExecutionContext.create(context).getContext();
      return { req: ctx.req, res: ctx.req.res };
    }
    const http = context.switchToHttp();
    return { req: http.getRequest(), res: http.getResponse() };
  }

  /**
   * Track authenticated callers by user id (stable across networks); anonymous
   * callers by Express `req.ip`, which honors `trust proxy` — never hand-parse
   * x-forwarded-for, its leftmost entry is client-spoofable.
   */
  protected async getTracker(req: Record<string, unknown>): Promise<string> {
    const user = req.user as { id?: string } | undefined;
    return user?.id ?? (req.ip as string | undefined) ?? 'unknown';
  }
}
