import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { KudosService } from './kudos.service';
import { KudosResult } from './models/kudos.model';
import { KudosUser } from './models/kudos-user.model';

@Resolver()
@UseGuards(GqlAuthGuard)
export class KudosResolver {
  constructor(private readonly kudosService: KudosService) {}

  @Mutation(() => KudosResult)
  @Throttle({ default: THROTTLE_PRESETS.KUDOS })
  async toggleKudos(
    @CurrentUser() user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
  ): Promise<KudosResult> {
    return this.kudosService.toggleKudos(rideId, user.id);
  }

  @Query(() => [KudosUser])
  async kudosList(
    @CurrentUser() _user: AuthUser,
    @Args('rideId', ParseUUIDPipe) rideId: string,
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 }) first: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<KudosUser[]> {
    const { users } = await this.kudosService.getKudosList(rideId, first, after);
    return users;
  }
}
