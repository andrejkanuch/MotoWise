import {
  TrackSponsorshipClickInputSchema,
  TrackSponsorshipImpressionInputSchema,
} from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { TrackSponsorshipClickInput } from './dto/track-click.input';
import { TrackSponsorshipImpressionInput } from './dto/track-impression.input';
import { Sponsorship } from './models/sponsorship.model';
import { SponsorshipsService } from './sponsorships.service';

@Resolver(() => Sponsorship)
@UseGuards(GqlAuthGuard)
export class SponsorshipsResolver {
  constructor(private readonly sponsorshipsService: SponsorshipsService) {}

  @Query(() => [Sponsorship])
  async routeSponsorships(
    @Args('routeId', { type: () => ID }, ParseUUIDPipe) routeId: string,
  ): Promise<Sponsorship[]> {
    return this.sponsorshipsService.getActiveByRoute(routeId);
  }

  @Mutation(() => Boolean)
  async trackSponsorshipImpression(
    @Args('input', new ZodValidationPipe(TrackSponsorshipImpressionInputSchema))
    input: TrackSponsorshipImpressionInput,
  ): Promise<boolean> {
    return this.sponsorshipsService.trackImpression(input.sponsorshipId);
  }

  @Mutation(() => Boolean)
  async trackSponsorshipClick(
    @Args('input', new ZodValidationPipe(TrackSponsorshipClickInputSchema))
    input: TrackSponsorshipClickInput,
  ): Promise<boolean> {
    return this.sponsorshipsService.trackClick(input.sponsorshipId);
  }
}
