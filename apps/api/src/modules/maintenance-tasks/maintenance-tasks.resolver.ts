import { CreateMaintenanceTaskSchema, UpdateMaintenanceTaskSchema } from '@motolearn/types';
import { UseGuards } from '@nestjs/common';
import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { CreateMaintenanceTaskInput } from './dto/create-maintenance-task.input';
import { UpdateMaintenanceTaskInput } from './dto/update-maintenance-task.input';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { MaintenanceTask } from './models/maintenance-task.model';

@Resolver(() => MaintenanceTask)
export class MaintenanceTasksResolver {
  constructor(private readonly maintenanceTasksService: MaintenanceTasksService) {}

  @Query(() => [MaintenanceTask])
  @UseGuards(GqlAuthGuard)
  async maintenanceTasks(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<MaintenanceTask[]> {
    return this.maintenanceTasksService.findByMotorcycle(user.id, motorcycleId);
  }

  @Mutation(() => MaintenanceTask)
  @UseGuards(GqlAuthGuard)
  async createMaintenanceTask(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(CreateMaintenanceTaskSchema))
    input: CreateMaintenanceTaskInput,
  ): Promise<MaintenanceTask> {
    return this.maintenanceTasksService.create(user.id, input);
  }

  @Mutation(() => MaintenanceTask)
  @UseGuards(GqlAuthGuard)
  async updateMaintenanceTask(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('input', new ZodValidationPipe(UpdateMaintenanceTaskSchema))
    input: UpdateMaintenanceTaskInput,
  ): Promise<MaintenanceTask> {
    return this.maintenanceTasksService.update(user.id, id, input);
  }

  @Mutation(() => MaintenanceTask)
  @UseGuards(GqlAuthGuard)
  async completeMaintenanceTask(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
    @Args('completedMileage', { type: () => Int, nullable: true }) completedMileage?: number,
  ): Promise<MaintenanceTask> {
    return this.maintenanceTasksService.complete(user.id, id, completedMileage);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteMaintenanceTask(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.maintenanceTasksService.softDelete(user.id, id);
  }
}
