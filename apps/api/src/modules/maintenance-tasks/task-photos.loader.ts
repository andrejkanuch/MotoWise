import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import type { TaskPhoto } from './models/task-photo.model';

@Injectable({ scope: Scope.REQUEST })
export class TaskPhotosLoader {
  private readonly loader: DataLoader<string, TaskPhoto[]>;
  // Request-scoped: every load is for the same authenticated user; captured from
  // load() and used as the C1 ownership anchor for receipts signed URLs (U7a).
  private ownerUserId: string | null = null;

  constructor(private readonly maintenanceTasksService: MaintenanceTasksService) {
    this.loader = new DataLoader<string, TaskPhoto[]>(async (taskIds) => {
      const map = await this.maintenanceTasksService.findPhotosByTaskIds(
        [...taskIds],
        this.ownerUserId ?? '',
      );
      return taskIds.map((id) => map.get(id) ?? []);
    });
  }

  load(taskId: string, ownerUserId: string): Promise<TaskPhoto[]> {
    this.ownerUserId = ownerUserId;
    return this.loader.load(taskId);
  }
}
