import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import type { TaskPhoto } from './models/task-photo.model';

@Injectable({ scope: Scope.REQUEST })
export class TaskPhotosLoader {
  private readonly loader: DataLoader<string, TaskPhoto[]>;

  constructor(private readonly maintenanceTasksService: MaintenanceTasksService) {
    this.loader = new DataLoader<string, TaskPhoto[]>(async (taskIds) => {
      const map = await this.maintenanceTasksService.findPhotosByTaskIds([...taskIds]);
      return taskIds.map((id) => map.get(id) ?? []);
    });
  }

  load(taskId: string): Promise<TaskPhoto[]> {
    return this.loader.load(taskId);
  }
}
