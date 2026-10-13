import type { DevicePlatform, FeedbackQuickPick } from '@motovault/types';
import { Field, ID, InputType, Int } from '@nestjs/graphql';

/** Validated by SendFeedbackInputSchema (@motovault/types) — keep the two in sync. */
@InputType()
export class SendFeedbackInput {
  @Field(() => ID, {
    description: 'Client-generated UUID per draft; reuse it on retry so the message is saved once',
  })
  clientId: string;

  @Field({ description: '1-4000 characters after trimming' })
  message: string;

  @Field(() => String, { nullable: true, description: 'love | wish | broken' })
  quickPick?: FeedbackQuickPick;

  @Field(() => String, { description: 'ios | android' })
  platform: DevicePlatform;

  @Field()
  appVersion: string;

  @Field({ nullable: true, description: 'expo-updates update id, when running an update' })
  updateId?: string;

  @Field({ description: 'App locale the form was shown in' })
  locale: string;

  @Field({ description: 'The developer may contact me about my feedback' })
  contactOptIn: boolean;

  @Field({
    nullable: true,
    description: 'Email to reach the rider at; omit or null to use the account email',
  })
  contactEmail?: string;

  @Field(() => Int, { description: 'FEEDBACK_CONTACT_WORDING_VERSION shown with the opt-in' })
  contactWordingVersion: number;
}
