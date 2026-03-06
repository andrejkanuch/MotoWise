import { CreateMotorcycleSchema } from '@motolearn/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateMotorcycleInput } from './dto/create-motorcycle.input';
import { UpdateMotorcycleInput } from './dto/update-motorcycle.input';
import { Motorcycle } from './models/motorcycle.model';
import { MotorcycleMake } from './models/motorcycle-make.model';
import { MotorcycleModelResult } from './models/motorcycle-model-result.model';
import { MotorcyclesService } from './motorcycles.service';
import { NhtsaService } from './nhtsa.service';

@Resolver(() => Motorcycle)
export class MotorcyclesResolver {
  constructor(
    private readonly motorcyclesService: MotorcyclesService,
    private readonly nhtsaService: NhtsaService,
  ) {}

  @Query(() => [Motorcycle])
  @UseGuards(GqlAuthGuard)
  async myMotorcycles(@CurrentUser() user: AuthUser): Promise<Motorcycle[]> {
    return this.motorcyclesService.findByUser(user.id);
  }

  @Query(() => [MotorcycleMake], { name: 'motorcycleMakes' })
  @UseGuards(GqlAuthGuard)
  async motorcycleMakes(): Promise<MotorcycleMake[]> {
    return this.nhtsaService.getMakes();
  }

  @Query(() => [MotorcycleModelResult], { name: 'motorcycleModels' })
  @UseGuards(GqlAuthGuard)
  async motorcycleModels(
    @Args('makeId', { type: () => Int }) makeId: number,
    @Args('year', { type: () => Int }) year: number,
  ): Promise<MotorcycleModelResult[]> {
    return this.nhtsaService.getModels(makeId, year);
  }

  @Mutation(() => Motorcycle)
  @UseGuards(GqlAuthGuard)
  async createMotorcycle(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateMotorcycleSchema)) input: CreateMotorcycleInput,
  ): Promise<Motorcycle> {
    return this.motorcyclesService.create(user.id, input);
  }

  @Mutation(() => Motorcycle)
  @UseGuards(GqlAuthGuard)
  async updateMotorcycle(
    @CurrentUser() user: AuthUser,
    @Args('id') id: string,
    @Args('input') input: UpdateMotorcycleInput,
  ): Promise<Motorcycle> {
    return this.motorcyclesService.update(user.id, id, input);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteMotorcycle(@CurrentUser() user: AuthUser, @Args('id') id: string): Promise<boolean> {
    return this.motorcyclesService.softDelete(user.id, id);
  }
}
