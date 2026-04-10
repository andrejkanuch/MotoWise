import { NotFoundException } from '@nestjs/common';

export const TRIP_SHARE_TOKEN_ERROR_CODES = {
  NOT_FOUND: 'TRIP_SHARE_TOKEN_NOT_FOUND',
  INVALID_FORMAT: 'TRIP_SHARE_TOKEN_INVALID_FORMAT',
} as const;

export type TripShareTokenErrorCode = keyof typeof TRIP_SHARE_TOKEN_ERROR_CODES;

export class TripShareTokenError extends NotFoundException {
  constructor(public readonly reason: TripShareTokenErrorCode = 'NOT_FOUND') {
    // Single user-facing message — preserves no-oracle guarantee
    super({ message: 'Trip not found', reason: TRIP_SHARE_TOKEN_ERROR_CODES[reason] });
  }
}
