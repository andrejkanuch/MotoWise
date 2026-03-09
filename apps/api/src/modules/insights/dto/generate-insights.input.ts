import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class GenerateInsightsInput {
  @Field(() => String)
  experienceLevel: string;

  @Field(() => String, { nullable: true })
  bikeMake?: string;

  @Field(() => String, { nullable: true })
  bikeModel?: string;

  @Field(() => Int, { nullable: true })
  bikeYear?: number;

  @Field(() => String, { nullable: true })
  bikeType?: string;

  @Field(() => Int, { nullable: true })
  currentMileage?: number;

  @Field(() => String, { nullable: true })
  ridingFrequency?: string;

  @Field(() => String, { nullable: true })
  maintenanceStyle?: string;
}
