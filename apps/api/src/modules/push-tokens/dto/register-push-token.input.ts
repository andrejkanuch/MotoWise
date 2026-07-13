import type { DevicePlatform } from '@motovault/types';
import { Field, InputType } from '@nestjs/graphql';

@InputType()
export class RegisterPushTokenInput {
  @Field({ description: 'The Expo push token for this device.' })
  token: string;

  // GraphQL wire type stays String; the DevicePlatform union narrows it at the
  // service boundary, and the Zod pipe + DB CHECK enforce ios|android at runtime.
  @Field(() => String, { description: "The device platform: 'ios' or 'android'." })
  platform: DevicePlatform;
}
