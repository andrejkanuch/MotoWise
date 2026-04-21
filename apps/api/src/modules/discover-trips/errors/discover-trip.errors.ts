import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';

export class DiscoverTripNotFoundError extends NotFoundException {
  constructor() {
    super('Discover trip not found');
  }
}

export class DiscoverTripAlreadyPublishedError extends ConflictException {
  constructor() {
    super('This trip is already published to Discover');
  }
}

export class DiscoverTripAlreadyClonedError extends ConflictException {
  constructor() {
    super('You have already cloned this trip');
  }
}

export class DiscoverTripQualityGateError extends BadRequestException {
  constructor(missing: string[]) {
    super(`Quality gate not met. Missing: ${missing.join(', ')}`);
  }
}

export class DiscoverTripNotOwnedError extends ForbiddenException {
  constructor() {
    super('You do not own this trip');
  }
}
