import {
  BadRequestException,
  InternalServerErrorException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import type { PostgrestError } from '@supabase/supabase-js';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { PG_ERROR, unwrap } from './unwrap';

const makeError = (code: string, message = 'db failure'): PostgrestError =>
  ({ code, message, details: '', hint: '', name: 'PostgrestError' }) as PostgrestError;

describe('unwrap', () => {
  let logger: Logger;

  beforeEach(() => {
    logger = new Logger('test');
    vi.spyOn(logger, 'error').mockImplementation(() => undefined);
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
    expect(logger.error).toHaveBeenCalledWith('[getThing] Failed to load thing: boom');
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
});
