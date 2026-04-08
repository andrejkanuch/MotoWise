import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class CommentAuthor {
  @Field(() => ID)
  id: string;

  @Field()
  displayName: string;

  @Field({ nullable: true })
  publicUsername?: string;

  @Field({ nullable: true })
  avatarUrl?: string;
}

@ObjectType()
export class Comment {
  @Field(() => ID)
  id: string;

  @Field()
  text: string;

  @Field()
  createdAt: string;

  @Field(() => Int)
  flaggedCount: number;

  @Field(() => ID, { nullable: true })
  parentCommentId?: string;

  @Field(() => CommentAuthor)
  author: CommentAuthor;

  @Field(() => [Comment], { nullable: true })
  replies?: Comment[];
}

@ObjectType()
export class CommentConnection {
  @Field(() => [Comment])
  comments: Comment[];

  @Field()
  hasNextPage: boolean;

  @Field({ nullable: true })
  endCursor?: string;

  @Field(() => Int)
  totalCount: number;
}
