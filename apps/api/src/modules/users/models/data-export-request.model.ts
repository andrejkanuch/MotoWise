import { Field, ID, ObjectType } from '@nestjs/graphql';

@ObjectType()
export class DataExportRequest {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  @Field()
  status: string;

  @Field()
  requestedAt: string;

  @Field({ nullable: true })
  completedAt?: string;

  @Field()
  createdAt: string;
}
