import { Field, InputType } from '@nestjs/graphql';

/** Metadata-only edit in v1 — file replacement is deferred (delete + re-create). */
@InputType()
export class UpdateDocumentInput {
  @Field({ nullable: true })
  title?: string;

  @Field({ nullable: true })
  categoryId?: string;

  /** YYYY-MM-DD. Pass null to clear the expiry (and its reminders). */
  @Field(() => String, { nullable: true })
  expiryDate?: string | null;

  @Field(() => String, { nullable: true })
  note?: string | null;

  @Field({ nullable: true })
  isPinned?: boolean;
}
