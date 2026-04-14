import { Field, ObjectType } from '@nestjs/graphql';
import { BrowsePlace } from './browse-place.model';

@ObjectType()
export class BrowseExploreRegionResult {
  @Field(() => BrowsePlace)
  country: BrowsePlace;

  @Field(() => BrowsePlace)
  region: BrowsePlace;
}
