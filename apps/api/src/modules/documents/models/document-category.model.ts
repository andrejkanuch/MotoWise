import type { DocumentCategoryKind } from '@motovault/types';
import { Field, ID, ObjectType } from '@nestjs/graphql';
// `kind` is a string-literal union, so @Field needs an explicit String type —
// reflection can't infer a GraphQL scalar from a union at runtime.

@ObjectType()
export class DocumentCategory {
  @Field(() => ID)
  id: string;

  @Field()
  name: string;

  /** 'seeded' | 'custom'. Emitted as a String scalar in the GraphQL schema. */
  @Field(() => String)
  kind: DocumentCategoryKind;

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
