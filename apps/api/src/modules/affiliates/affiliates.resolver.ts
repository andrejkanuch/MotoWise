import { TrackAffiliateClickInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { AffiliatesService } from './affiliates.service';
import { TrackClickInput } from './dto/track-click.input';
import { AffiliateProduct } from './models/affiliate-product.model';

@Resolver(() => AffiliateProduct)
@UseGuards(GqlAuthGuard)
export class AffiliatesResolver {
  constructor(private readonly affiliatesService: AffiliatesService) {}

  @Mutation(() => AffiliateProduct)
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async trackAffiliateClick(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(TrackAffiliateClickInputSchema)) input: TrackClickInput,
  ): Promise<AffiliateProduct> {
    return this.affiliatesService.trackClick(user.id, input);
  }
}
