import { Field, ID, Int, ObjectType } from '@nestjs/graphql';
import { GqlMotorcycleType } from '../../../common/enums/graphql-enums';

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

  @Field({ nullable: true })
  primaryPhotoUrl?: string;

  @Field(() => Int, { nullable: true })
  currentMileage?: number;

  @Field({ nullable: true })
  mileageUnit?: string;

  @Field({ nullable: true })
  mileageUpdatedAt?: string;

  @Field(() => GqlMotorcycleType, { nullable: true })
  type?: string;

  @Field(() => Int, { nullable: true })
  engineCc?: number;

  @Field()
  createdAt: string;
}
