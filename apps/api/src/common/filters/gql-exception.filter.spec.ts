import {
  ArgumentsHost,
  InternalServerErrorException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import * as Sentry from '@sentry/nestjs';
import { GraphQLError } from 'graphql';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AllExceptionsFilter } from './gql-exception.filter';

vi.mock('@sentry/nestjs', () => ({
  captureException: vi.fn(),
}));

function createGqlHost(): ArgumentsHost {
  return {
    getType: vi.fn().mockReturnValue('graphql'),
  } as unknown as ArgumentsHost;
}

function createHttpHost() {
  const response = {
    status: vi.fn().mockReturnThis(),
    json: vi.fn().mockReturnThis(),
  };
  const host = {
    getType: vi.fn().mockReturnValue('http'),
    switchToHttp: vi.fn().mockReturnValue({ getResponse: () => response }),
  } as unknown as ArgumentsHost;
  return { host, response };
}

describe('AllExceptionsFilter', () => {
  let filter: AllExceptionsFilter;

  beforeEach(() => {
    vi.clearAllMocks();
    filter = new AllExceptionsFilter();
  });

  describe('HTTP context', () => {
    it('writes a real response for a 401 (previously the request hung)', () => {
      const { host, response } = createHttpHost();

      const result = filter.catch(new UnauthorizedException('Missing authorization header'), host);

      expect(response.status).toHaveBeenCalledWith(401);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 401,
        message: 'Missing authorization header',
        error: 'UNAUTHENTICATED',
      });
      expect(result).toBeUndefined();
    });

    it('hides the message for 500s and writes a generic body', () => {
      const { host, response } = createHttpHost();

      filter.catch(new InternalServerErrorException('db credentials leaked'), host);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith({
        statusCode: 500,
        message: 'Internal server error',
        error: 'INTERNAL_SERVER_ERROR',
      });
    });

    it('writes a 500 response for non-HttpException errors', () => {
      const { host, response } = createHttpHost();

      filter.catch(new Error('unexpected'), host);

      expect(response.status).toHaveBeenCalledWith(500);
      expect(response.json).toHaveBeenCalledWith(
        expect.objectContaining({ statusCode: 500, message: 'Internal server error' }),
      );
    });
  });

  describe('GraphQL context', () => {
    it('keeps the UNAUTHENTICATED string code (mobile token refresh depends on it)', () => {
      const result = filter.catch(
        new UnauthorizedException('Invalid or expired token'),
        createGqlHost(),
      );

      expect(result).toBeInstanceOf(GraphQLError);
      expect((result as GraphQLError).extensions.code).toBe('UNAUTHENTICATED');
      expect((result as GraphQLError).message).toBe('Invalid or expired token');
    });

    it('passes through <500 messages with their mapped codes', () => {
      const result = filter.catch(new NotFoundException('Share link not found'), createGqlHost());

      expect(result).toBeInstanceOf(GraphQLError);
      expect((result as GraphQLError).extensions.code).toBe('NOT_FOUND');
      expect((result as GraphQLError).message).toBe('Share link not found');
    });

    it('hides the message for unknown (500) exceptions', () => {
      const result = filter.catch(new Error('SELECT * FROM users failed'), createGqlHost());

      expect(result).toBeInstanceOf(GraphQLError);
      expect((result as GraphQLError).message).toBe('Internal server error');
      expect((result as GraphQLError).extensions.code).toBe('INTERNAL_SERVER_ERROR');
    });
  });

  describe('Sentry capture', () => {
    it('captures non-HttpException errors', () => {
      const exception = new Error('boom');

      filter.catch(exception, createGqlHost());

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
      expect(Sentry.captureException).toHaveBeenCalledWith(exception);
    });

    it('captures HttpExceptions with status >= 500', () => {
      filter.catch(new InternalServerErrorException('boom'), createGqlHost());

      expect(Sentry.captureException).toHaveBeenCalledTimes(1);
    });

    it('does NOT capture a 404 (no quota burn on expected 4xx)', () => {
      filter.catch(new NotFoundException('not found'), createGqlHost());

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });

    it('does NOT capture a 401', () => {
      filter.catch(new UnauthorizedException(), createGqlHost());

      expect(Sentry.captureException).not.toHaveBeenCalled();
    });
  });
});
