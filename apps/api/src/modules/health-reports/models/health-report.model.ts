import { Field, ID, ObjectType } from '@nestjs/graphql';
import { GqlHealthReportStatus } from '../../../common/enums/graphql-enums';

@ObjectType()
export class HealthReport {
  @Field(() => ID)
  id: string;

  @Field()
  userId: string;

  // Nullable: webhook-created pending reports have no bike until the user generates
  @Field(() => ID, { nullable: true })
  motorcycleId?: string;

  @Field(() => GqlHealthReportStatus)
  status: string;

  @Field({ nullable: true })
  pdfUrl?: string;

  @Field({ nullable: true })
  iapTransactionId?: string;

  @Field()
  createdAt: string;

  @Field({ nullable: true })
  completedAt?: string;
}
