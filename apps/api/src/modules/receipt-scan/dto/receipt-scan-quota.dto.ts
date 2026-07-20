import { Field, Int, ObjectType } from '@nestjs/graphql';

/**
 * Tier-INDEPENDENT raw quota (KTD-3). `used` is a straight count of this UTC
 * month's non-failed, non-cancelled, non-onboarding scans — it does NOT depend
 * on the resolved tier or ENTITLEMENTS_ENFORCED. The client computes `remaining`
 * from `limit` + RevenueCat `isPro`, so the launch paywall fires even while the
 * server forces everyone to `pro` (ENTITLEMENTS_ENFORCED=false).
 */
@ObjectType()
export class ReceiptScanQuota {
  @Field(() => Int)
  used: number;

  @Field(() => Int)
  limit: number;

  /** ISO 8601 — 1st of next month, 00:00 UTC. */
  @Field()
  resetDate: string;
}
