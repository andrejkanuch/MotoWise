import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { isPostgrestAuthError, PG_ERROR, TOKEN_REJECTED_MESSAGE, unwrap } from './unwrap';

const makeError = (code: string, message = 'db failure'): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('unwrap', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
    vi.spyOn(logger, 'warn').mockImplementation(() => undefined);
  });

  it('returns data on success', () => {
    const result = unwrap(
      { data: { id: '1' }, error: null },
      { logger, op: 'getThing', message: 'Failed' },
    );
    expect(result).toEqual({ id: '1' });
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('maps PGRST116 to NotFoundException when notFound is given', () => {
    expect(() =>
      unwrap(
        { data: null, error: makeError(PG_ERROR.NOT_FOUND) },
        { logger, op: 'getThing', message: 'Failed', notFound: 'Thing not found' },
      ),
    ).toThrow(NotFoundException);
    // Not-found is an expected outcome — must not log as an error.
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('attaches the cause on the not-found path too', () => {
    // Holds `unwrap` to its documented contract: EVERY exception it throws
    // carries the Postgres error, so no throw site is a diagnostic dead end.
    try {
      unwrap(
        { data: null, error: makeError(PG_ERROR.NOT_FOUND, 'Results contain 0 rows') },
        { logger, op: 'getThing', message: 'Failed', notFound: 'Thing not found' },
      );
      expect.unreachable('unwrap should have thrown');
    } catch (err) {
      expect(((err as Error).cause as Error).message).toBe('PGRST116: Results contain 0 rows');
    }
  });

  it('falls through PGRST116 to the generic branch when notFound is absent', () => {
    expect(() =>
      unwrap(
        { data: null, error: makeError(PG_ERROR.NOT_FOUND) },
        { logger, op: 'getThing', message: 'Failed' },
      ),
    ).toThrow(InternalServerErrorException);
    expect(logger.error).toHaveBeenCalledOnce();
  });

  it('invokes onConflict on 23505 and returns its value without throwing', () => {
    const onConflict = vi.fn(() => ({ id: 'existing' }));
    const result = unwrap(
      { data: null, error: makeError(PG_ERROR.UNIQUE_VIOLATION) },
      { logger, op: 'createThing', message: 'Failed', onConflict },
    );
    expect(result).toEqual({ id: 'existing' });
    expect(onConflict).toHaveBeenCalledOnce();
    expect(logger.error).not.toHaveBeenCalled();
  });

  it('logs and throws InternalServerErrorException by default on a generic error', () => {
    expect(() =>
      unwrap(
        { data: null, error: makeError('XXYYZ', 'boom') },
        { logger, op: 'getThing', message: 'Failed to load thing' },
      ),
    ).toThrow(InternalServerErrorException);
    // The code is part of the log line: its absence is why triaging
    // MOTO-VAULT-NODE-NESTJS-B needed a second pass over the Render logs.
    expect(logger.error).toHaveBeenCalledWith('[getThing] Failed to load thing: boom (XXYYZ)');
  });

  it('attaches the Postgres code and message as the exception cause', () => {
    try {
      unwrap(
        { data: null, error: makeError('XXYYZ', 'boom') },
        { logger, op: 'getThing', message: 'Failed to load thing' },
      );
      expect.unreachable('unwrap should have thrown');
    } catch (err) {
      // Sentry's LinkedErrors integration walks `cause`, so this is what puts the
      // PostgREST code on the event instead of only in the Render logs.
      expect((err as Error).cause).toBeInstanceOf(Error);
      expect(((err as Error).cause as Error).message).toBe('XXYYZ: boom');
    }
  });

  describe('details and hint', () => {
    const withDetail = (details: string, hint: string): PostgrestError =>
      ({
        code: 'XXYYZ',
        message: 'boom',
        details,
        hint,
        name: 'PostgrestError',
      }) as PostgrestError;

    it('puts details and hint on the log line, where they can actually be read', () => {
      // They used to be hung off the cause Error's own `cause` as a plain object.
      // LinkedErrors walks a chain of *Errors*, so a plain object terminates the
      // chain: both fields were collected and then serialized nowhere, while
      // neither log line printed them either.
      expect(() =>
        unwrap(
          { data: null, error: withDetail('Key (user_id)=(u1) is not present', 'check the FK') },
          { logger, op: 'getThing', message: 'Failed to load thing' },
        ),
      ).toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith(
        '[getThing] Failed to load thing: boom (XXYYZ) [details=Key (user_id)=(u1) is not present, hint=check the FK]',
      );
    });

    it('keeps details and hint off the exception cause', () => {
      // instrument.ts sets sendDefaultPii: false and PostgREST `details` can echo
      // the offending row, so the cause stays code + message only.
      try {
        unwrap(
          { data: null, error: withDetail('user_id=(u1)', 'check the FK') },
          { logger, op: 'getThing', message: 'Failed to load thing' },
        );
        expect.unreachable('unwrap should have thrown');
      } catch (err) {
        const cause = (err as Error).cause as Error;
        expect(cause.message).toBe('XXYYZ: boom');
        expect(cause.cause).toBeUndefined();
      }
    });

    it('omits whichever of the two PostgREST left empty', () => {
      expect(() =>
        unwrap(
          { data: null, error: withDetail('', 'check the FK') },
          { logger, op: 'getThing', message: 'Failed to load thing' },
        ),
      ).toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith(
        '[getThing] Failed to load thing: boom (XXYYZ) [hint=check the FK]',
      );
    });

    it('adds no bracket at all when PostgREST supplied neither', () => {
      // ` [details=null, hint=null]` on every line is noise that trains you to
      // stop reading the tail, which is where the useful part lives.
      expect(() =>
        unwrap(
          { data: null, error: makeError('XXYYZ', 'boom') },
          { logger, op: 'getThing', message: 'Failed to load thing' },
        ),
      ).toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledWith('[getThing] Failed to load thing: boom (XXYYZ)');
    });

    it('appends them to the token-rejection warn line too', () => {
      expect(() =>
        unwrap(
          { data: null, error: { ...withDetail('', 'refresh the session'), code: 'PGRST303' } },
          { logger, op: 'myRides', message: 'Failed to fetch rides' },
        ),
      ).toThrow(UnauthorizedException);
      expect(logger.warn).toHaveBeenCalledWith(
        '[myRides] token rejected by PostgREST: boom (PGRST303) [hint=refresh the session]',
      );
    });
  });

  it('throws the provided exception class on a generic error', () => {
    expect(() =>
      unwrap(
        { data: null, error: makeError('XXYYZ') },
        { logger, op: 'getThing', message: 'Bad input', error: BadRequestException },
      ),
    ).toThrow(BadRequestException);
  });

  it('does not apply onConflict to a non-23505 error', () => {
    const onConflict = vi.fn(() => 'should-not-run');
    expect(() =>
      unwrap(
        { data: null, error: makeError('XXYYZ') },
        { logger, op: 'createThing', message: 'Failed', onConflict },
      ),
    ).toThrow(InternalServerErrorException);
    expect(onConflict).not.toHaveBeenCalled();
  });

  describe('PostgREST token rejections', () => {
    const authCases = [
      [PG_ERROR.JWT_INVALID, 'JWT expired'],
      [PG_ERROR.JWT_MISSING, 'Anonymous access is disabled'],
      // The production case: MOTO-VAULT-NODE-NESTJS-B/C, 2026-08-27.
      [PG_ERROR.JWT_CLAIMS_INVALID, 'JWT issued at future'],
    ] as const;

    it.each(authCases)('maps %s to UnauthorizedException', (code, message) => {
      expect(() =>
        unwrap(
          { data: null, error: makeError(code, message) },
          { logger, op: 'myRides', message: 'Failed to fetch rides' },
        ),
      ).toThrow(UnauthorizedException);
    });

    it.each(authCases)('logs %s at warn, never at error', (code, message) => {
      expect(() =>
        unwrap(
          { data: null, error: makeError(code, message) },
          { logger, op: 'myRides', message: 'Failed to fetch rides' },
        ),
      ).toThrow(UnauthorizedException);
      // A refused token is not a server fault. Logging it at error is what made
      // a self-healing condition look like an outage.
      expect(logger.error).not.toHaveBeenCalled();
      expect(logger.warn).toHaveBeenCalledWith(
        `[myRides] token rejected by PostgREST: ${message} (${code})`,
      );
    });

    it('throws the client-visible token message, not the caller-supplied one', () => {
      // Sub-500 messages reach the client through AllExceptionsFilter, so this
      // string must not carry the caller's internal wording.
      expect(() =>
        unwrap(
          { data: null, error: makeError(PG_ERROR.JWT_CLAIMS_INVALID) },
          { logger, op: 'myRides', message: 'Failed to fetch rides' },
        ),
      ).toThrow(TOKEN_REJECTED_MESSAGE);
    });

    it('ignores ctx.error so the client always gets a refreshable 401', () => {
      // A caller asking for BadRequestException cannot know the token is at
      // fault; answering 400 would strand the client with no refresh path.
      expect(() =>
        unwrap(
          { data: null, error: makeError(PG_ERROR.JWT_CLAIMS_INVALID) },
          { logger, op: 'getThing', message: 'Bad input', error: BadRequestException },
        ),
      ).toThrow(UnauthorizedException);
    });

    it('attaches the PostgREST code as the cause', () => {
      try {
        unwrap(
          { data: null, error: makeError(PG_ERROR.JWT_CLAIMS_INVALID, 'JWT issued at future') },
          { logger, op: 'myRides', message: 'Failed to fetch rides' },
        );
        expect.unreachable('unwrap should have thrown');
      } catch (err) {
        expect(((err as Error).cause as Error).message).toBe('PGRST303: JWT issued at future');
      }
    });

    it('leaves PGRST300 on the 500 path — a missing JWT secret must keep paging', () => {
      expect(() =>
        unwrap(
          { data: null, error: makeError('PGRST300', 'JWT secret missing') },
          { logger, op: 'myRides', message: 'Failed to fetch rides' },
        ),
      ).toThrow(InternalServerErrorException);
      expect(logger.error).toHaveBeenCalledOnce();
      expect(logger.warn).not.toHaveBeenCalled();
    });

    it('does not divert a not-found or conflict result', () => {
      // Guards branch order: the auth check must sit below the PGRST116 /
      // 23505 special cases, which own their codes.
      expect(() =>
        unwrap(
          { data: null, error: makeError(PG_ERROR.NOT_FOUND) },
          { logger, op: 'getThing', message: 'Failed', notFound: 'Thing not found' },
        ),
      ).toThrow(NotFoundException);
    });
  });
});

describe('isPostgrestAuthError', () => {
  it.each([
    PG_ERROR.JWT_INVALID,
    PG_ERROR.JWT_MISSING,
    PG_ERROR.JWT_CLAIMS_INVALID,
  ])('is true for %s', (code) => {
    expect(isPostgrestAuthError(makeError(code))).toBe(true);
  });

  it.each([
    'PGRST300',
    PG_ERROR.NOT_FOUND,
    PG_ERROR.UNIQUE_VIOLATION,
    '',
    'pgrst303',
  ])('is false for %s', (code) => {
    expect(isPostgrestAuthError(makeError(code))).toBe(false);
  });

  it.each([null, undefined])('is false for %s', (error) => {
    expect(isPostgrestAuthError(error)).toBe(false);
  });
});
