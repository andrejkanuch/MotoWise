import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class CompleteOnboardingInput {
  @Field()
  riderType: string;

  @Field(() => [String])
  goals: string[];

  @Field({ nullable: true })
  measurementSystem?: string;

  @Field({ nullable: true, defaultValue: true })
  maintenanceReminders?: boolean;

  @Field({ nullable: true, defaultValue: false })
  seasonalTips?: boolean;

  @Field({ nullable: true, defaultValue: false })
  recallAlerts?: boolean;

  @Field({ nullable: true })
  bikeMake?: string;

  @Field({ nullable: true })
  bikeModel?: string;

  @Field(() => Int, { nullable: true })
  bikeYear?: number;

  @Field({ nullable: true })
  bikeNickname?: string;

  @Field({ nullable: true })
  bikePhotoUrl?: string;

  @Field({ nullable: true })
  currency?: string;
}
