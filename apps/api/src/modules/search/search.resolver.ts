import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../../common/decorators/public.decorator';
import { TypeaheadResult } from './models/typeahead-result.model';
import { SearchService } from './search.service';

@Resolver()
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => TypeaheadResult)
  @Public()
  async searchTypeahead(
    @Args('q', { nullable: true }) q: string,
    @Args('limit', { type: () => Int, defaultValue: 8 }) limit: number,
  ): Promise<TypeaheadResult> {
    return this.searchService.typeahead(q ?? null, limit);
  }
}
