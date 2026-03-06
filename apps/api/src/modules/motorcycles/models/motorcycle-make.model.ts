import { Field, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class MotorcycleMake {
  @Field(() => Int)
  makeId: number;

  @Field()
  makeName: string;

  @Field()
  isPopular: boolean;
}
