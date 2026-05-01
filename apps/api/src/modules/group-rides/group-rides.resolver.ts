import {
  CreateGroupRideInputSchema,
  UpdateGroupRideInputSchema,
} from '@motovault/types/validators';
import { UseGuards } from '@nestjs/common';
import { Args, Float, ID, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateGroupRideInput } from './dto/create-group-ride.input';
import { UpdateGroupRideInput } from './dto/update-group-ride.input';
import { GroupRidesService } from './group-rides.service';
import { GroupRide, GroupRideConnection } from './models/group-ride.model';

@Resolver(() => GroupRide)
@UseGuards(GqlAuthGuard)
export class GroupRidesResolver {
  constructor(private readonly groupRidesService: GroupRidesService) {}

  // ==========================================
  // Queries
  // ==========================================

  @Query(() => GroupRideConnection)
  @Public()
  async getGroupRides(
    @Args('first', { type: () => Int, nullable: true, defaultValue: 20 })
    first?: number,
    @Args('after', { nullable: true }) after?: string,
    @Args('nearLat', { type: () => Float, nullable: true }) nearLat?: number,
    @Args('nearLng', { type: () => Float, nullable: true }) nearLng?: number,
    @Args('radiusKm', { type: () => Float, nullable: true }) radiusKm?: number,
  ): Promise<GroupRideConnection> {
    return this.groupRidesService.getGroupRides(first ?? 20, after, nearLat, nearLng, radiusKm);
  }

  @Query(() => GroupRide)
  @Public()
  async groupRideDetail(
    @Args('groupRideId', { type: () => ID }, ParseUUIDPipe) groupRideId: string,
  ): Promise<GroupRide> {
    return this.groupRidesService.getGroupRideDetail(groupRideId);
  }

  // ==========================================
  // Mutations
  // ==========================================

  @Mutation(() => GroupRide)
  async createGroupRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateGroupRideInputSchema))
    input: CreateGroupRideInput,
  ): Promise<GroupRide> {
    return this.groupRidesService.createGroupRide(user.id, input);
  }

  @Mutation(() => GroupRide)
  async updateGroupRide(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(UpdateGroupRideInputSchema))
    input: UpdateGroupRideInput,
  ): Promise<GroupRide> {
    return this.groupRidesService.updateGroupRide(user.id, input.groupRideId, input);
  }

  @Mutation(() => Boolean)
  async cancelGroupRide(
    @CurrentUser() user: AuthUser,
    @Args('groupRideId', { type: () => ID }, ParseUUIDPipe) groupRideId: string,
  ): Promise<boolean> {
    return this.groupRidesService.cancelGroupRide(user.id, groupRideId);
  }

  @Mutation(() => Boolean)
  async joinGroupRide(
    @CurrentUser() user: AuthUser,
    @Args('groupRideId', { type: () => ID }, ParseUUIDPipe) groupRideId: string,
  ): Promise<boolean> {
    return this.groupRidesService.joinGroupRide(user.id, groupRideId);
  }

  @Mutation(() => Boolean)
  async leaveGroupRide(
    @CurrentUser() user: AuthUser,
    @Args('groupRideId', { type: () => ID }, ParseUUIDPipe) groupRideId: string,
  ): Promise<boolean> {
    return this.groupRidesService.leaveGroupRide(user.id, groupRideId);
  }
}
