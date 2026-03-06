import { SupportedLocaleSchema } from '@motolearn/types';
import { CallHandler, ExecutionContext, Injectable, NestInterceptor } from '@nestjs/common';
import { GqlExecutionContext } from '@nestjs/graphql';
import type { Observable } from 'rxjs';

@Injectable()
export class LocaleInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = GqlExecutionContext.create(context);
    const req = ctx.getContext().req;
    const acceptLang = req.headers['accept-language']?.split(',')[0]?.split('-')[0];
    const xLocale = req.headers['x-locale'];
    const raw = acceptLang ?? xLocale ?? 'en';
    req.locale = SupportedLocaleSchema.catch('en').parse(raw);
    return next.handle();
  }
}
