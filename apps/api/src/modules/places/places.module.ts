import { Module } from '@nestjs/common';
import { PlacesResolver } from './places.resolver';
import { PlacesService } from './places.service';

@Module({
  providers: [PlacesService, PlacesResolver],
  exports: [PlacesService],
})
export class PlacesModule {}
