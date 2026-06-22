import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class DocumentFileInput {
  @Field()
  storagePath: string;

  @Field(() => Int)
  fileSizeBytes: number;

  @Field()
  mimeType: string;
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
