import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class SearchArticlesInput {
  @Field({ nullable: true })
  query?: string;

  @Field({ nullable: true })
  category?: string;

  @Field({ nullable: true })
  difficulty?: string;

  @Field(() => Int, { nullable: true, defaultValue: 20 })
  first?: number;

  @Field({ nullable: true })
  after?: string;
}
