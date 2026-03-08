import { Field, InputType, Int } from '@nestjs/graphql';

@InputType()
export class AddTaskPhotoInput {
  @Field()
  taskId: string;

  @Field()
  storagePath: string;

  @Field(() => Int, { nullable: true })
  fileSizeBytes?: number;
}
