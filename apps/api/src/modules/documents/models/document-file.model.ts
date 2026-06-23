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

  /**
   * Internal private-bucket key ({userId}/{motorcycleId}/{documentId}/{filename}).
   * Deliberately NOT a GraphQL field — clients never need the raw path; they mint
   * short-lived access via getDocumentSignedUrl. Kept as a plain property for the
   * service/loader/delete paths only.
   */
  storagePath: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;

  @Field()
  mimeType: string;

  @Field()
  createdAt: string;
}
