import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class TripTemplateFilterInput {
  @Field({ nullable: true })
  country?: string;

  @Field({ nullable: true })
  region?: string;

  @Field({ nullable: true })
  difficulty?: string;

  @Field(() => Int, { nullable: true })
  dayCountMin?: number;

  @Field(() => Int, { nullable: true })
  dayCountMax?: number;

  @Field({ nullable: true })
  surfaceType?: string;

  @Field({ nullable: true })
  searchText?: string;
}
