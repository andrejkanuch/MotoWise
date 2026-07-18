import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddTaskPhotoInput {
  @Field()
  taskId: string;

  @Field()
  storagePath: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;

  // U7a: lets U7b link a scanned receipt (private `receipts` bucket) without a
  // re-upload. Omitted → legacy public `maintenance-photos`.
  @Field({ nullable: true })
  bucket?: string;
}
