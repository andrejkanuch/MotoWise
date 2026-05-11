import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { IsRouteSavedLoader } from './is-route-saved.loader';
import { RoutesController } from './routes.controller';
import { RoutesResolver } from './routes.resolver';
import { RoutesService } from './routes.service';
import { SavedRoutesResolver } from './saved-routes.resolver';
import { SavedRoutesService } from './saved-routes.service';

/**
 * @deprecated Routes module is being deprecated in favor of the unified Trips module.
 * All resolvers are kept alive for backward compatibility with existing mobile app
 * builds in the App Store. They log deprecation warnings on every call.
 *
 * Migration order:
 * 1. Ship new mobile app version using trips-based queries
 * 2. Wait for old builds to drop off (monitor deprecation logs)
 * 3. Delete SavedRoutesResolver/Service, deprecated RoutesResolver queries
 * 4. Drop routes DB table (Track 9D)
 */
@Module({
  imports: [EntitlementsModule],
  controllers: [RoutesController],
  providers: [
    RoutesResolver,
    RoutesService,
    SavedRoutesResolver,
    SavedRoutesService,
    IsRouteSavedLoader,
  ],
  exports: [RoutesService, SavedRoutesService],
})
export class RoutesModule {}
