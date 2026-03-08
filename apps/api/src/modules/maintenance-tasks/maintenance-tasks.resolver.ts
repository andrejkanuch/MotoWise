import {
  AddTaskPhotoSchema,
  CreateMaintenanceTaskSchema,
  UpdateMaintenanceTaskSchema,
} from '@motolearn/types';
import { UseGuards } from '@nestjs/common';
import { Args, ID, Int, Mutation, Parent, Query, ResolveField, Resolver } from '@nestjs/graphql';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-uuid.pipe';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { AddTaskPhotoInput } from './dto/add-task-photo.input';
import { CreateMaintenanceTaskInput } from './dto/create-maintenance-task.input';
import { UpdateMaintenanceTaskInput } from './dto/update-maintenance-task.input';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import { MaintenanceTask } from './models/maintenance-task.model';
import { TaskPhoto } from './models/task-photo.model';

@Resolver(() => MaintenanceTask)
export class MaintenanceTasksResolver {
  constructor(private readonly maintenanceTasksService: MaintenanceTasksService) {}

  @Query(() => [MaintenanceTask])
  @UseGuards(GqlAuthGuard)
  async allMaintenanceTasks(@CurrentUser() user: AuthUser): Promise<MaintenanceTask[]> {
    return this.maintenanceTasksService.findAllForUser(user.id);
  }

  @Query(() => [MaintenanceTask])
  @UseGuards(GqlAuthGuard)
  async maintenanceTasks(
    @CurrentUser() user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
  ): Promise<MaintenanceTask[]> {
    return this.maintenanceTasksService.findByMotorcycle(user.id, motorcycleId);
  }

  @Query(() => [MaintenanceTask])
  @UseGuards(GqlAuthGuard)
  async maintenanceTaskHistory(
    @CurrentUser() _user: AuthUser,
    @Args('motorcycleId', ParseUUIDPipe) motorcycleId: string,
    @Args('limit', { type: () => Int, nullable: true, defaultValue: 100 }) limit: number,
  ): Promise<MaintenanceTask[]> {
    return this.maintenanceTasksService.findAllHistory(motorcycleId, limit);
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
    const completed = await this.maintenanceTasksService.complete(user.id, id, completedMileage);

    // If the task is recurring, create the next occurrence
    if (completed.isRecurring) {
      await this.maintenanceTasksService.createNextRecurrence(completed);
    }

    return completed;
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteMaintenanceTask(
    @CurrentUser() user: AuthUser,
    @Args('id', ParseUUIDPipe) id: string,
  ): Promise<boolean> {
    return this.maintenanceTasksService.softDelete(user.id, id);
  }

  // ── Photo mutations ─────────────────────────────────────────────

  @Mutation(() => TaskPhoto)
  @UseGuards(GqlAuthGuard)
  async addTaskPhoto(
    @CurrentUser() user: AuthUser,
    @Args('input', new ZodValidationPipe(AddTaskPhotoSchema)) input: AddTaskPhotoInput,
  ): Promise<TaskPhoto> {
    return this.maintenanceTasksService.addPhoto(
      user.id,
      input.taskId,
      input.storagePath,
      input.fileSizeBytes,
    );
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async deleteTaskPhoto(
    @CurrentUser() user: AuthUser,
    @Args('photoId', { type: () => ID }) photoId: string,
  ): Promise<boolean> {
    return this.maintenanceTasksService.deletePhoto(user.id, photoId);
  }

  // ── Field resolver for photos ───────────────────────────────────

  @ResolveField(() => [TaskPhoto])
  async photos(@Parent() task: MaintenanceTask): Promise<TaskPhoto[]> {
    if (task.photos && task.photos.length > 0) return task.photos;
    const map = await this.maintenanceTasksService.findPhotosByTaskIds([task.id]);
    return map.get(task.id) ?? [];
  }
}
