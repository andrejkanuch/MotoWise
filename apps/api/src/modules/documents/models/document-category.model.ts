import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DocumentCategory {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  /** 'seeded' | 'custom'. */
  @Field()
  kind: string;

  @Field()
  isHidden: boolean;

  /** Whether adding a document in this category prompts for an expiry date (R9). */
  @Field()
  promptsExpiry: boolean;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;
}
