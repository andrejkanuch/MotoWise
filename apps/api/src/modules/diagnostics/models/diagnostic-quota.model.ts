import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Tier-INDEPENDENT AI-diagnosis quota for this UTC month — the count the
 * submitDiagnostic limit applies. The client derives `remaining` from `limit` +
 * RevenueCat `isPro` and gates the flow at its START, so a free rider is never
 * walked through the whole form only to be refused at submit.
 */
@ObjectType()
export class DiagnosticQuota {
  @Field(() => Int)
  used: number;

  @Field(() => Int)
  limit: number;

  /** ISO 8601 — 1st of next month, 00:00 UTC. */
  @Field()
  resetDate: string;
}
