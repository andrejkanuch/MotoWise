import { Field, InputType, Int } from '@nestjs/graphql';
import { GqlMaintenanceServiceType } from '../../../common/enums/graphql-enums';

/**
 * User-confirmed "remind me for the next <type>" input (receipt-scan P7). Creates
 * a fresh recurring pending task of the given canonical service type — never a
 * fuzzy match against, or a mutation of, an existing pending task.
 */
@InputType()
export class CreateServiceReminderInput {
  @Field()
  motorcycleId: string;

  @Field(() => GqlMaintenanceServiceType)
  serviceType: string;

  @Field(() => Int, { nullable: true })
  intervalKm?: number;

  @Field(() => Int, { nullable: true })
  intervalDays?: number;
}
