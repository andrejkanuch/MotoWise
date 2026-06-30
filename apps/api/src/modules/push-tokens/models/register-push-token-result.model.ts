import { Field, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class RegisterPushTokenResult {
  @Field(() => Boolean, { description: 'True when the token was registered/refreshed.' })
  success: boolean;
}
