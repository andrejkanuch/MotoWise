import type { DocumentMimeType } from '@motovault/types';
import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class DocumentFileInput {
  @Field()
  storagePath: string;

  @Field(() => Int)
  fileSizeBytes: number;

  // GraphQL wire type stays String; the TS type narrows to the shared allowlist
  // union so this DTO stays assignable to the (now literal-typed) Zod CreateDocument
  // and the ZodValidationPipe remains the runtime gate. The explicit `() => String`
  // is required because DocumentMimeType is a type-only union — reflect-metadata
  // can't infer a runtime type, so schema generation throws without it.
  @Field(() => String)
  mimeType: DocumentMimeType;
}

@InputType()
export class CreateDocumentInput {
  /** Client-generated UUID; the upload path embeds it, and the row id must equal it. */
  @Field()
  documentId: string;

  @Field()
  motorcycleId: string;

  @Field()
  categoryId: string;

  @Field()
  title: string;

  /** YYYY-MM-DD. */
  @Field({ nullable: true })
  expiryDate?: string;

  @Field({ nullable: true })
  note?: string;

  @Field(() => [DocumentFileInput])
  files: DocumentFileInput[];
}
