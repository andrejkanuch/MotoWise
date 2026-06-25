import { Field, ID, ObjectType } from '@nestjs/graphql';
import { DocumentFile } from './document-file.model';

@ObjectType()
export class Document {
  @Field(() => ID)
  id: string;

  @Field()
  motorcycleId: string;

  @Field()
  categoryId: string;

  @Field()
  title: string;

  /** YYYY-MM-DD. Null when no expiry/reminder is set. */
  @Field({ nullable: true })
  expiryDate?: string;

  /** Plain text (no markup interpreted). */
  @Field({ nullable: true })
  note?: string;

  @Field()
  isPinned: boolean;

  @Field()
  createdAt: string;

  @Field()
  updatedAt: string;

  /** Resolved via the DataLoader-backed `files` field resolver. */
  @Field(() => [DocumentFile])
  files: DocumentFile[];
}
