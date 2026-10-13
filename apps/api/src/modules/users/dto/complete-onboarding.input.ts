import { Field, InputType, Int } from '@nestjs/graphql';

/** The rider ticked "the developer may contact me" on the onboarding notifications step. */
@InputType()
export class FeedbackContactOptInInput {
  @Field(() => Int, { description: 'FEEDBACK_CONTACT_WORDING_VERSION shown with the opt-in line' })
  wordingVersion: number;

  @Field({ description: 'App locale the opt-in line was shown in' })
  locale: string;
}

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

  @Field({ nullable: true })
  bikePhotoUrl?: string;

  @Field({ nullable: true })
  bikeMileageUnit?: string;

  @Field({ nullable: true })
  currency?: string;

  @Field(() => [String], {
    nullable: true,
    description: 'OEM schedule IDs the user accepted in the maintenance swipe screen',
  })
  acceptedOemScheduleIds?: string[];

  @Field({ nullable: true, description: 'Meta click ID from deep link for CAPI attribution' })
  fbclid?: string;

  @Field({
    nullable: true,
    description: 'UUID for client-server event deduplication with Meta CAPI',
  })
  eventId?: string;

  @Field(() => FeedbackContactOptInInput, {
    nullable: true,
    description: 'Sent only when the contact opt-in line was ticked; saved with the account email',
  })
  feedbackContactOptIn?: FeedbackContactOptInInput;
}
