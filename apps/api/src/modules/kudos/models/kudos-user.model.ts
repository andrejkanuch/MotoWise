import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class KudosUser {
  @Field(() => ID)
  id: string;

  @Field({ nullable: true })
  displayName?: string;

  @Field({ nullable: true })
  avatarUrl?: string;

  @Field({ nullable: true })
  publicUsername?: string;
}
