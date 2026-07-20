import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { MaintenanceTasksService } from './maintenance-tasks.service';
import type { MaintenanceTaskLineItem } from './models/task-line-item.model';

/**
 * Request-scoped batching loader for a task's structured line items, so a task
 * list resolving `lineItems` does not N+1 (mirrors TaskPhotosLoader).
 */
@Injectable({ scope: Scope.REQUEST })
export class TaskLineItemsLoader {
  private readonly loader: DataLoader<string, MaintenanceTaskLineItem[]>;
  private ownerUserId: string | null = null;

  constructor(private readonly maintenanceTasksService: MaintenanceTasksService) {
    this.loader = new DataLoader<string, MaintenanceTaskLineItem[]>(async (taskIds) => {
      const map = await this.maintenanceTasksService.findLineItemsByTaskIds(
        [...taskIds],
        this.ownerUserId ?? '',
      );
      return taskIds.map((id) => map.get(id) ?? []);
    });
  }

  load(taskId: string, ownerUserId: string): Promise<MaintenanceTaskLineItem[]> {
    this.ownerUserId = ownerUserId;
    return this.loader.load(taskId);
  }
}
