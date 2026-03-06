import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { GraphQLError } from 'graphql';
import { describe, expect, it } from 'vitest';
import { AllExceptionsFilter } from './gql-exception.filter';

describe('AllExceptionsFilter', () => {
  const filter = new AllExceptionsFilter();

  const httpToGqlMappings: Array<[string, HttpException, string]> = [
    ['400 -> BAD_REQUEST', new BadRequestException('Bad input'), 'BAD_REQUEST'],
    ['401 -> UNAUTHENTICATED', new UnauthorizedException('Not logged in'), 'UNAUTHENTICATED'],
    ['403 -> FORBIDDEN', new ForbiddenException('No access'), 'FORBIDDEN'],
    ['404 -> NOT_FOUND', new NotFoundException('Missing resource'), 'NOT_FOUND'],
    ['409 -> CONFLICT', new ConflictException('Duplicate entry'), 'CONFLICT'],
    ['429 -> TOO_MANY_REQUESTS', new HttpException('Slow down', 429), 'TOO_MANY_REQUESTS'],
    [
      '500 -> INTERNAL_SERVER_ERROR',
      new InternalServerErrorException('Server broke'),
      'INTERNAL_SERVER_ERROR',
    ],
  ];

  it.each(httpToGqlMappings)('should map HTTP %s', (_label, exception, expectedCode) => {
    const result = filter.catch(exception);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.extensions.code).toBe(expectedCode);
    expect(result.message).toBe(exception.message);
  });

  it('should fall back to INTERNAL_SERVER_ERROR for unknown HTTP status codes', () => {
    const exception = new HttpException('Teapot', 418);
    const result = filter.catch(exception);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.extensions.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should return INTERNAL_SERVER_ERROR for non-HttpException errors', () => {
    const error = new Error('database connection lost');
    const result = filter.catch(error);

    expect(result).toBeInstanceOf(GraphQLError);
    expect(result.extensions.code).toBe('INTERNAL_SERVER_ERROR');
  });

  it('should NOT leak raw error message for non-HttpException errors', () => {
    const error = new Error('secret database password in error');
    const result = filter.catch(error);

    expect(result.message).toBe('Internal server error');
    expect(result.message).not.toContain('secret');
  });
});
