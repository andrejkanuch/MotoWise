import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Article {
  @Field(() => ID)
  id: string;

  @Field()
  slug: string;

  @Field()
  title: string;

  @Field()
  difficulty: string;

  @Field()
  category: string;

  @Field(() => Int)
  viewCount: number;

  @Field()
  isSafetyCritical: boolean;

  @Field()
  generatedAt: string;

  @Field()
  updatedAt: string;
}
