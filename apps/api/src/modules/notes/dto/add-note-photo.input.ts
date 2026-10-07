import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddNotePhotoInput {
  @Field()
  noteId: string;

  @Field()
  storagePath: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;
}
