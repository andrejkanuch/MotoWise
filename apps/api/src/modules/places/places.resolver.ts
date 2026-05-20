import { UseGuards } from '@nestjs/common';
import { Args, Query, Resolver } from '@nestjs/graphql';
import { Public } from '../../common/decorators/public.decorator';
import { GqlAuthGuard } from '../../common/guards/gql-auth.guard';
import { BrowseExploreRegionResult } from './models/browse-explore-region-result.model';
import { BrowsePlace } from './models/browse-place.model';
import { PlacesService } from './places.service';

/**
 * Public taxonomy reads power web SSR (/explore, sitemap, metadata). The global
 * GraphQL throttler keys on IP; Next dev triggers duplicate fetches (metadata +
 * RSC + prefetch) and quickly returns 429, which graphql-request surfaces as a
 * hard error. These queries are cheap and read-only — skip rate limits here.
 */
@Resolver(() => BrowsePlace)
@UseGuards(GqlAuthGuard)
export class PlacesResolver {
  constructor(private readonly placesService: PlacesService) {}

  @Query(() => [BrowsePlace], {
    description: 'All countries in the places taxonomy (browse / explore)',
  })
  @Public()
  browseCountries(): Promise<BrowsePlace[]> {
    return this.placesService.browseCountries();
  }

  @Query(() => BrowsePlace, {
    nullable: true,
    description: 'Country by URL slug (lowercase ISO code, e.g. it, de)',
  })
  @Public()
  browseCountryBySlug(@Args('slug') slug: string): Promise<BrowsePlace | null> {
    return this.placesService.browseCountryBySlug(slug);
  }

  @Query(() => [BrowsePlace], { description: 'Regions with population > 0 for a country slug' })
  @Public()
  browseRegionsByCountrySlug(@Args('countrySlug') countrySlug: string): Promise<BrowsePlace[]> {
    return this.placesService.browseRegionsByCountrySlug(countrySlug);
  }

  @Query(() => BrowseExploreRegionResult, {
    nullable: true,
    description: 'Country + region for /explore/:country/:region marketing pages',
  })
  @Public()
  browseExploreRegion(
    @Args('countrySlug') countrySlug: string,
    @Args('regionSlug') regionSlug: string,
  ): Promise<BrowseExploreRegionResult | null> {
    return this.placesService.browseExploreRegion(countrySlug, regionSlug);
  }
}
