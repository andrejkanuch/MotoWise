import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class Motorcycle {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  make: string;

  @Field()
  model: string;

  @Field(() => Int)
  year: number;

  @Field({ nullable: true })
  nickname?: string;

  @Field()
  isPrimary: boolean;

  @Field()
  createdAt: string;
}
