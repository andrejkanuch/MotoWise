import { ArgumentsHost, Catch, HttpException, HttpStatus } from '@nestjs/common';
import { GqlContextType, GqlExceptionFilter } from '@nestjs/graphql';
import * as Sentry from '@sentry/nestjs';
import type { Response } from 'express';
import { GraphQLError } from 'graphql';

/**
 * String GraphQL error codes — KEEP STABLE: mobile token refresh matches on
 * 'UNAUTHENTICATED' to trigger a session refresh.
 */
const HTTP_TO_GQL_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
  503: 'SERVICE_UNAVAILABLE',
};

const INTERNAL_ERROR_CODE = 'INTERNAL_SERVER_ERROR';
const INTERNAL_ERROR_MESSAGE = 'Internal server error';

@Catch()
export class AllExceptionsFilter implements GqlExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost) {
    const isHttpException = exception instanceof HttpException;
    const status = isHttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    // Expected 4xx HttpExceptions (401 token expiry, 404s, validation) are normal
    // traffic — capturing them burned Sentry quota. Report only unknown exceptions
    // and server errors.
    if (!isHttpException || status >= HttpStatus.INTERNAL_SERVER_ERROR) {
      Sentry.captureException(exception);
    }

    // Pass exception messages through to clients only for <500 — 5xx messages can
    // leak internals (stack details, SQL, upstream errors).
    const message =
      isHttpException && status < HttpStatus.INTERNAL_SERVER_ERROR
        ? exception.message
        : INTERNAL_ERROR_MESSAGE;
    const code = HTTP_TO_GQL_CODE[status] ?? INTERNAL_ERROR_CODE;

    if (host.getType<GqlContextType>() === 'graphql') {
      // No writable response exists in a GraphQL context — Apollo formats the
      // returned error into the response envelope.
      return new GraphQLError(message, { extensions: { code } });
    }

    // HTTP (REST controllers: /health, webhooks): the filter MUST write the
    // response — returning a GraphQLError here left the request hanging forever.
    const response = host.switchToHttp().getResponse<Response>();
    response.status(status).json({ statusCode: status, message, error: code });
    return undefined;
  }
}
