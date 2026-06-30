import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RegisterPushTokenInput {
  @Field({ description: 'The Expo push token for this device.' })
  token: string;

  @Field({ description: "The device platform: 'ios' or 'android'." })
  platform: string;
}
