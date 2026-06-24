import { Field, InputType, Int } from '@nestjs/graphql';

/** Admin list filters + forward cursor pagination (plan U4). */
@InputType()
export class ListBlogPostsInput {
  @Field({ nullable: true })
  status?: string;

  @Field({ nullable: true })
  type?: string;

  @Field(() => Int, { nullable: true })
  first?: number;

  @Field({ nullable: true })
  after?: string;
}
