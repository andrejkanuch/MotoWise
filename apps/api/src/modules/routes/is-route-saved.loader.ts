import { Injectable, Scope } from '@nestjs/common';
import DataLoader from 'dataloader';
import { SavedRoutesService } from './saved-routes.service';

/**
 * Request-scoped DataLoader for batching isRouteSaved checks.
 * Prevents N+1 when resolving isSaved on a list of routes.
 */
@Injectable({ scope: Scope.REQUEST })
export class IsRouteSavedLoader {
  private loader: DataLoader<string, boolean> | null = null;
  private userId: string | null = null;

  constructor(private readonly savedRoutesService: SavedRoutesService) {}

  /** Initialize the loader with the authenticated user's ID */
  forUser(userId: string): this {
    if (this.userId !== userId || !this.loader) {
      this.userId = userId;
      this.loader = new DataLoader<string, boolean>(async (routeIds) => {
        const map = await this.savedRoutesService.areRoutesSaved(userId, [...routeIds]);
        return routeIds.map((id) => map.get(id) ?? false);
      });
    }
    return this;
  }

  load(routeId: string): Promise<boolean> {
    if (!this.loader) {
      throw new Error('IsRouteSavedLoader not initialized — call forUser() first');
    }
    return this.loader.load(routeId);
  }
}
