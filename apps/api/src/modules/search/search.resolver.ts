import { UseGuards } from '@nestjs/common';
import { Args, Int, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { THROTTLE_PRESETS } from '../../config/constants';
import { LatLngInput } from './dto/lat-lng.input';
import { TypeaheadResult } from './models/typeahead-result.model';
import { SearchService } from './search.service';

@Resolver()
@UseGuards(GqlAuthGuard)
export class SearchResolver {
  constructor(private readonly searchService: SearchService) {}

  @Query(() => TypeaheadResult)
  @Public()
  @Throttle({ default: THROTTLE_PRESETS.STANDARD })
  async searchTypeahead(
    @Args('q', { nullable: true }) q: string,
    @Args('near', { type: () => LatLngInput, nullable: true }) near: LatLngInput,
    @Args('limit', { type: () => Int, defaultValue: 8 }) limit: number,
  ): Promise<TypeaheadResult> {
    return this.searchService.typeahead(q ?? null, near ?? null, limit);
  }
}
