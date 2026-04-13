import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { LatLngInput, SearchRoutesFilterInput } from './dto/search-routes.input';
import { RouteSearchConnection } from './models/search-result.model';
import { SearchService } from './search.service';

@Resolver()
@UseGuards(GqlAuthGuard)
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => RouteSearchConnection)
  @Public()
  async searchRoutes(
    @Args('q', { nullable: true }) q?: string,
    @Args('near', { type: () => LatLngInput, nullable: true }) near?: LatLngInput,
    @Args('filters', { type: () => SearchRoutesFilterInput, nullable: true })
    filters?: SearchRoutesFilterInput,
    @Args('first', { type: () => Int, defaultValue: 20 }) first?: number,
    @Args('after', { nullable: true }) after?: string,
  ): Promise<RouteSearchConnection> {
    return this.searchService.searchRoutes(q, near, filters, first ?? 20, after);
  }
}
