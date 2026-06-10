import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class ShareLink {
  @Field(() => ID)
  id: string;

  /** Plaintext token — only present in the createShareLink response (show-once). */
  @Field(() => String, { nullable: true })
  token?: string;

  @Field()
  motorcycleId: string;

  @Field()
  expiresAt: string;

  @Field()
  createdAt: string;

  /** Full share URL — only present in the createShareLink response (show-once). */
  @Field(() => String, { nullable: true })
  url?: string;
}
