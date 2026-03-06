import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ContentFlag {
  @Field(() => ID)
  id: string;

  @Field()
  articleId: string;

  @Field()
  userId: string;

  @Field({ nullable: true })
  sectionReference?: string;

  @Field()
  comment: string;

  @Field()
  status: string;

  @Field()
  createdAt: string;
}
