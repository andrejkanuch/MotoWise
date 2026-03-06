import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { AuthUser, CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { CreateMotorcycleInput } from './dto/create-motorcycle.input';
import { Motorcycle } from './models/motorcycle.model';
import { MotorcyclesService } from './motorcycles.service';

@Resolver(() => Motorcycle)
export class MotorcyclesResolver {
  constructor(private readonly motorcyclesService: MotorcyclesService) {}

  @Query(() => [Motorcycle])
  @UseGuards(GqlAuthGuard)
  async myMotorcycles(@CurrentUser() user: AuthUser): Promise<Motorcycle[]> {
    return this.motorcyclesService.findByUser(user.id);
  }

  @Mutation(() => Motorcycle)
  @UseGuards(GqlAuthGuard)
  async createMotorcycle(
    @CurrentUser() user: AuthUser,
    @Args('input') input: CreateMotorcycleInput,
  ): Promise<Motorcycle> {
    return this.motorcyclesService.create(user.id, input);
  }
}
