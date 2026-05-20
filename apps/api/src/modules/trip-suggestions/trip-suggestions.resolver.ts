import {
  CreateTripSuggestionInputSchema,
  RespondToTripSuggestionInputSchema,
  SetTripParticipantRoleInputSchema,
} from '@motovault/types';
import { ParseUUIDPipe } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
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
  async tripSuggestions(
    @Args('tripId', { type: () => ID }, ParseUUIDPipe) tripId: string,
  ): Promise<TripSuggestion[]> {
    // Auth is enforced by the guard; RLS scopes visibility to trip participants.
    return this.service.list(tripId);
  }

  @Mutation(() => TripSuggestion)
  async createTripSuggestion(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateTripSuggestionInputSchema))
    input: CreateTripSuggestionInput,
  ): Promise<TripSuggestion> {
    return this.service.create(user.id, input);
  }

  @Mutation(() => TripSuggestion)
  async respondToTripSuggestion(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(RespondToTripSuggestionInputSchema))
    input: RespondToTripSuggestionInput,
  ): Promise<TripSuggestion> {
    return this.service.respond(user.id, input);
  }

  @Mutation(() => Boolean)
  async setTripParticipantRole(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(SetTripParticipantRoleInputSchema))
    input: SetParticipantRoleInput,
  ): Promise<boolean> {
    return this.service.setParticipantRole(user.id, input);
  }
}
