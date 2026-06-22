import { Field, ID, InputType } from '@nestjs/graphql';

/**
 * Approve a single maintenance draft row. Validated by ApproveMaintenanceDraftInputSchema
 * (Zod, @motovault/types) via ZodValidationPipe in the resolver. `kind` selects the draft
 * table ('schedule' → oem_maintenance_schedules, 'spec' → motorcycle_specs).
 */
@InputType()
export class ApproveMaintenanceDraftInput {
  // Narrowed to the literal union (emits `String` in the schema; Zod is the runtime guard) so the
  // service call needs no unsafe cast.
  @Field()
  kind: 'schedule' | 'spec';

  @Field(() => ID)
  id: string;
}
