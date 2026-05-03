import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { RoutesController } from './routes.controller';
import { RoutesResolver } from './routes.resolver';
import { RoutesService } from './routes.service';

/**
 * @deprecated Routes module is being deprecated in favor of the unified Trips module.
 * SavedRoutesResolver/Service/Loader have been removed — use TripSavesService instead.
 * Remaining resolvers (GPX export, share-to-discover, sitemap) will be migrated next.
 */
@Module({
  imports: [EntitlementsModule],
  controllers: [RoutesController],
  providers: [RoutesResolver, RoutesService],
  exports: [RoutesService],
})
export class RoutesModule {}
