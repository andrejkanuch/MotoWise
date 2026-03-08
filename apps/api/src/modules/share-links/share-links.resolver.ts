import { CreateShareLinkSchema } from '@motolearn/types';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateShareLinkInput } from './dto/create-share-link.input';
import { ShareLink } from './models/share-link.model';
import { SharedBikeHistory } from './models/shared-bike-history.model';
import { ShareLinksService } from './share-links.service';

@Resolver(() => ShareLink)
export class ShareLinksResolver {
  constructor(private readonly shareLinksService: ShareLinksService) {}

  @Mutation(() => ShareLink)
  @UseGuards(GqlAuthGuard)
  async createShareLink(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateShareLinkSchema))
    input: CreateShareLinkInput,
  ): Promise<ShareLink> {
    return this.shareLinksService.create(user.id, input.motorcycleId, input.expiresInDays ?? 30);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async revokeShareLink(
    @CurrentUser() user: AuthUser,
    @Args('linkId', { type: () => ID }) linkId: string,
  ): Promise<boolean> {
    return this.shareLinksService.revoke(user.id, linkId);
  }

  @Query(() => [ShareLink])
  @UseGuards(GqlAuthGuard)
  async myShareLinks(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', { type: () => ID }) motorcycleId: string,
  ): Promise<ShareLink[]> {
    return this.shareLinksService.findByMotorcycle(user.id, motorcycleId);
  }

  @Query(() => SharedBikeHistory)
  @Public()
  @Throttle({ default: { limit: 10, ttl: 60000 } })
  async sharedBikeHistory(@Args('token') token: string): Promise<SharedBikeHistory> {
    return this.shareLinksService.resolve(token);
  }
}
