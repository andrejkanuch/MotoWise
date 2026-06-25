import { Field, ID, InputType } from '@nestjs/graphql';

/** Create a blog category (slug auto-derived from name). Admin-only (plan U9 taxonomy pickers). */
@InputType()
export class CreateBlogCategoryInput {
  @Field()
  name: string;

  @Field(() => ID, { nullable: true })
  parentId?: string;
}

/** Create a blog keyword (slug auto-derived from name). Admin-only (plan U9 taxonomy pickers). */
@InputType()
export class CreateBlogKeywordInput {
  @Field()
  name: string;
}
