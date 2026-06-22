import { Field, Float, ID, Int, ObjectType } from '@nestjs/graphql';
import { GqlMaintenancePriority } from '../../../common/enums/graphql-enums';

/**
 * Admin-only DTOs for the maintenance draft review page (U4). These expose verification /
 * provenance fields that the public `OemSchedule` type deliberately omits, so draft data
 * never leaks onto the public schema.
 */
@ObjectType()
export class AdminOemScheduleDraft {
  @Field(() => ID)
  id: string;

  @Field()
  make: string;

  @Field({ nullable: true })
  model?: string;

  @Field({ nullable: true })
  variant?: string;

  @Field()
  taskName: string;

  @Field(() => Int, { nullable: true })
  intervalKm?: number;

  @Field(() => Int, { nullable: true })
  intervalDays?: number;

  @Field(() => GqlMaintenancePriority)
  priority: GqlMaintenancePriority;

  @Field()
  isSafetyCritical: boolean;

  @Field({ nullable: true })
  sourcePage?: string;

  @Field({ nullable: true })
  sourceContext?: string;

  @Field({ nullable: true })
  sourceTitle?: string;

  @Field()
  createdAt: string;
}

@ObjectType()
export class AdminMotorcycleSpecDraft {
  @Field(() => ID)
  id: string;

  @Field()
  make: string;

  @Field({ nullable: true })
  model?: string;

  @Field({ nullable: true })
  variant?: string;

  @Field()
  specType: string;

  @Field()
  specName: string;

  @Field(() => Float)
  valueNumeric: number;

  @Field({ nullable: true })
  valueDisplay?: string;

  @Field()
  unit: string;

  @Field()
  isSafetyCritical: boolean;

  @Field({ nullable: true })
  sourcePage?: string;

  @Field({ nullable: true })
  sourceContext?: string;

  @Field({ nullable: true })
  sourceTitle?: string;

  @Field()
  createdAt: string;
}

@ObjectType()
export class MaintenanceDraftReview {
  @Field(() => [AdminOemScheduleDraft])
  schedules: AdminOemScheduleDraft[];

  @Field(() => [AdminMotorcycleSpecDraft])
  specs: AdminMotorcycleSpecDraft[];
}
