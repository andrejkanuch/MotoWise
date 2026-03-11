import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class UpdateMotorcycleInput {
  @Field(() => String, { nullable: true })
  make?: string;

  @Field(() => String, { nullable: true })
  model?: string;

  @Field(() => Int, { nullable: true })
  year?: number;

  @Field(() => String, { nullable: true })
  nickname?: string;

  @Field(() => Boolean, { nullable: true })
  isPrimary?: boolean;

  @Field(() => String, { nullable: true })
  primaryPhotoUrl?: string;

  @Field(() => Int, { nullable: true })
  currentMileage?: number;

  @Field(() => String, { nullable: true })
  mileageUnit?: string;
}
