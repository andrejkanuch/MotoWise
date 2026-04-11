import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class SharedTripParticipant {
  @Field() anonId!: string;
  @Field() role!: string;
  @Field() status!: string;
  @Field() displayName!: string;
  @Field(() => String, { nullable: true }) avatarUrl?: string | null;
}
