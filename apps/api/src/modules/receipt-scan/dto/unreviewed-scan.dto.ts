import { Field, ObjectType } from '@nestjs/graphql';
import { ReceiptExtractionResult } from './receipt-scan-result.dto';

/**
 * A completed-but-unreviewed scan (status='success' AND saved_at IS NULL).
 * Powers resume + the home priority card. Carries the parsed result so the
 * review card can rehydrate without a second call.
 */
@ObjectType()
export class UnreviewedScan {
  @Field()
  scanId: string;

  @Field(() => String, { nullable: true })
  storagePath?: string | null;

  @Field()
  createdAt: string;

  @Field(() => ReceiptExtractionResult, { nullable: true })
  result?: ReceiptExtractionResult | null;
}
