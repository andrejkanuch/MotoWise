import { SupportedLocaleSchema } from '@motovault/types';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Observable } from 'rxjs';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;
    const xLocale = req.headers['x-locale']?.slice(0, 5);
    // Primary tag of the first Accept-Language entry, e.g. "pt-BR" from
    // "pt-BR,pt;q=0.9". Splitting on '-' here would collapse "pt-BR" → "pt"
    // (unsupported) and fall back to English; instead try the full tag first,
    // then the base subtag.
    const acceptTag = req.headers['accept-language']?.slice(0, 20)?.split(',')[0]?.trim();
    req.locale = this.resolveLocale(xLocale ?? acceptTag);
    return next.handle();
  }

  /** Resolves a raw tag to a supported locale: full tag first, then base subtag. */
  private resolveLocale(raw: string | undefined): string {
    if (!raw) return 'en';
    const full = SupportedLocaleSchema.safeParse(raw);
    if (full.success) return full.data;
    const base = raw.split('-')[0];
    return SupportedLocaleSchema.catch('en').parse(base);
  }
}
