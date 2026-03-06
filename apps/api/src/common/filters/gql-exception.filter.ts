import { Catch, HttpException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

const HTTP_TO_GQL_CODE: Record<number, string> = {
  400: 'BAD_REQUEST',
  401: 'UNAUTHENTICATED',
  403: 'FORBIDDEN',
  404: 'NOT_FOUND',
  409: 'CONFLICT',
  429: 'TOO_MANY_REQUESTS',
  500: 'INTERNAL_SERVER_ERROR',
};

@Catch()
export class AllExceptionsFilter implements GqlExceptionFilter {
  catch(exception: unknown) {
    if (exception instanceof HttpException) {
      const status = exception.getStatus();
      return new GraphQLError(exception.message, {
        extensions: {
          code: HTTP_TO_GQL_CODE[status] ?? 'INTERNAL_SERVER_ERROR',
        },
      });
    }
    return new GraphQLError('Internal server error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }
}
