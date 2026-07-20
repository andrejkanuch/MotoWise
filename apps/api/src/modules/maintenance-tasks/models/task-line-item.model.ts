import { Field, Float, ID, ObjectType } from '@nestjs/graphql';
import { GqlMaintenanceServiceType } from '../../../common/enums/graphql-enums';

/**
 * A structured per-operation line item of a maintenance task (receipt-scan
 * structure redesign). Maps a row of `maintenance_task_line_items`. `serviceType`
 * is the canonical MaintenanceServiceType classification; cost fields are
 * optional itemization detail (the task total remains authoritative).
 */
@ObjectType()
export class MaintenanceTaskLineItem {
  @Field(() => ID)
  id: string;

  @Field()
  taskId: string;

  @Field(() => GqlMaintenanceServiceType)
  serviceType: string;

  @Field()
  label: string;

  @Field(() => String, { nullable: true })
  partRef?: string | null;

  @Field(() => Float, { nullable: true })
  quantity?: number | null;

  @Field(() => Float, { nullable: true })
  unitPrice?: number | null;

  @Field(() => Float, { nullable: true })
  lineTotal?: number | null;

  @Field()
  createdAt: string;
}
