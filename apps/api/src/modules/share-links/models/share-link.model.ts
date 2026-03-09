import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ShareLink {
  @Field(() => ID)
  id: string;

  @Field()
  token: string;

  @Field()
  motorcycleId: string;

  @Field()
  expiresAt: string;

  @Field()
  createdAt: string;

  @Field()
  url: string;
}
