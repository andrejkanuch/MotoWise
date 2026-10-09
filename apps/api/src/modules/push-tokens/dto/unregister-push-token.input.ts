import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class UnregisterPushTokenInput {
  @Field({ description: 'The Expo push token to remove from the signed-in account.' })
  token: string;
}
