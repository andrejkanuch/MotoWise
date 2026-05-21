import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../../common/decorators/public.decorator';
import { LatLngInput } from './dto/lat-lng.input';
import { TypeaheadResult } from './models/typeahead-result.model';
import { SearchService } from './search.service';

@Resolver()
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => TypeaheadResult)
  @Public()
  async searchTypeahead(
    @Args('q', { nullable: true }) q: string,
    @Args('near', { type: () => LatLngInput, nullable: true }) near: LatLngInput,
    @Args('limit', { type: () => Int, defaultValue: 8 }) limit: number,
  ): Promise<TypeaheadResult> {
    return this.searchService.typeahead(q ?? null, near ?? null, limit);
  }
}
