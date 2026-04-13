import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RouteSuggestion {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  @Field()
  slug: string;

  @Field()
  countryCode: string;

  @Field({ nullable: true })
  regionCode?: string;
}

@ObjectType()
export class PlaceSuggestion {
  @Field(() => Int)
  id: number;

  @Field()
  name: string;

  @Field()
  kind: string;

  @Field()
  countryCode: string;

  @Field({ nullable: true })
  regionCode?: string;

  @Field(() => Int)
  population: number;
}

@ObjectType()
export class TypeaheadResult {
  @Field(() => [RouteSuggestion])
  routes: RouteSuggestion[];

  @Field(() => [PlaceSuggestion])
  places: PlaceSuggestion[];
}
