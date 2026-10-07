import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class NotePhoto {
  @Field(() => ID)
  id: string;

  @Field()
  noteId: string;

  @Field()
  storagePath: string;

  @Field()
  publicUrl: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;

  @Field()
  mimeType: string;

  @Field()
  createdAt: string;
}
