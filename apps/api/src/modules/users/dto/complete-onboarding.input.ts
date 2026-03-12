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
  annualRepairSpend?: string;

  @Field({ nullable: true })
  reminderChannel?: string;

  @Field({ nullable: true })
  lastServiceDate?: string;

  @Field({ nullable: true, defaultValue: true })
  maintenanceReminders?: boolean;

  @Field({ nullable: true, defaultValue: false })
  seasonalTips?: boolean;

  @Field({ nullable: true, defaultValue: false })
  recallAlerts?: boolean;

  @Field({ nullable: true, defaultValue: false })
  weeklySummary?: boolean;

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
