import { ArgumentsHost, Catch, HttpException } from '@nestjs/common';
import { GqlExceptionFilter } from '@nestjs/graphql';
import { GraphQLError } from 'graphql';

@Catch()
export class AllExceptionsFilter implements GqlExceptionFilter {
  catch(exception: unknown, _host: ArgumentsHost) {
    if (exception instanceof HttpException) {
      return new GraphQLError(exception.message, {
        extensions: {
          code: exception.getStatus(),
          response: exception.getResponse(),
        },
      });
    }
    return new GraphQLError('Internal server error', {
      extensions: { code: 'INTERNAL_SERVER_ERROR' },
    });
  }
}
