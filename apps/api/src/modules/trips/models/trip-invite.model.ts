import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TripInvite {
  @Field(() => ID)
  id: string;

  @Field()
  invitedUserId: string;

  @Field()
  invitedAt: string;

  @Field({ nullable: true })
  acceptedAt?: string;

  @Field({ nullable: true })
  declinedAt?: string;
}
