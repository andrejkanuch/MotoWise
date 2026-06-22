import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

/**
 * A single file in a document. The bucket is PRIVATE — there is intentionally no
 * publicUrl field. Clients obtain a short-lived URL per file via the explicit
 * getDocumentSignedUrl query.
 */
@ObjectType()
export class DocumentFile {
  @Field(() => ID)
  id: string;

  @Field()
  documentId: string;

  @Field()
  storagePath: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;

  @Field()
  mimeType: string;

  @Field()
  createdAt: string;
}
