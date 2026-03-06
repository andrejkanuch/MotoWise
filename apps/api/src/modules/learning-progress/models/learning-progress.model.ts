import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class LearningProgress {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  articleId: string;

  @Field()
  articleRead: boolean;

  @Field()
  quizCompleted: boolean;

  @Field(() => Int, { nullable: true })
  quizBestScore?: number;

  @Field({ nullable: true })
  firstReadAt?: string;

  @Field({ nullable: true })
  lastReadAt?: string;
}
