import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CompleteOnboardingInput {
  @Field()
  experienceLevel: string;

  @Field(() => [String])
  ridingGoals: string[];

  @Field({ nullable: true })
  ridingFrequency?: string;

  @Field({ nullable: true })
  maintenanceStyle?: string;

  @Field(() => [String])
  learningFormats: string[];

  @Field({ nullable: true })
  bikeMake?: string;

  @Field({ nullable: true })
  bikeModel?: string;

  @Field(() => Int, { nullable: true })
  bikeYear?: number;

  @Field({ nullable: true })
  bikeType?: string;

  @Field(() => Int, { nullable: true })
  bikeMileage?: number;

  @Field({ nullable: true })
  bikeNickname?: string;
}
