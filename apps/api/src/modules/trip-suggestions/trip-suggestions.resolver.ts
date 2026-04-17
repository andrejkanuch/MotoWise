import {
  CreateTripSuggestionInputSchema,
  RespondToTripSuggestionInputSchema,
  SetTripParticipantRoleInputSchema,
} from '@motovault/types';
import { ParseUUIDPipe, UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import {
  CreateTripSuggestionInput,
  RespondToTripSuggestionInput,
  SetParticipantRoleInput,
} from './dto/trip-suggestion.inputs';
import { TripSuggestion } from './models/trip-suggestion.model';
import { TripSuggestionsService } from './trip-suggestions.service';

@Resolver(() => TripSuggestion)
export class TripSuggestionsResolver {
  constructor(private readonly service: TripSuggestionsService) {}

  @Query(() => [TripSuggestion])
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async tripSuggestions(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<TripSuggestion[]> {
    // Auth is enforced by the guard; RLS scopes visibility to trip participants.
    return this.service.list(tripId);
  }

  @Mutation(() => TripSuggestion)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async createTripSuggestion(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripSuggestionInputSchema))
    input: CreateTripSuggestionInput,
  ): Promise<TripSuggestion> {
    return this.service.create(user.id, input);
  }

  @Mutation(() => TripSuggestion)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async respondToTripSuggestion(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(RespondToTripSuggestionInputSchema))
    input: RespondToTripSuggestionInput,
  ): Promise<TripSuggestion> {
    return this.service.respond(user.id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async setTripParticipantRole(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SetTripParticipantRoleInputSchema))
    input: SetParticipantRoleInput,
  ): Promise<boolean> {
    return this.service.setParticipantRole(user.id, input);
  }
}
