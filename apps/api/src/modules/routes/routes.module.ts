import { Module } from '@nestjs/common';
import { EntitlementsModule } from '../entitlements/entitlements.module';
import { IsRouteSavedLoader } from './is-route-saved.loader';
import { RoutesController } from './routes.controller';
import { RoutesResolver } from './routes.resolver';
import { RoutesService } from './routes.service';
import { SavedRoutesResolver } from './saved-routes.resolver';
import { SavedRoutesService } from './saved-routes.service';

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
