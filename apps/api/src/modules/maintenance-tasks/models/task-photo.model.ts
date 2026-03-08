import { Field, ID, Int, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class TaskPhoto {
  @Field(() => ID)
  id: string;

  @Field()
  taskId: string;

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
