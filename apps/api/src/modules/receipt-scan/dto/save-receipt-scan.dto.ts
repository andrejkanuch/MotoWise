import { createUnionType, Field, Float, InputType, ObjectType } from '@nestjs/graphql';
import { ReceiptScanError } from './receipt-scan-result.dto';

/**
 * Payload for the reviewed-scan save (U7b / KTD-11). Mirrors the review card:
 * the user may have edited any field before committing. `type` dispatches the
 * write to the expense (logExpense) or maintenance (completed-task-with-cost)
 * path. Odometer is opt-in and carries its PRINTED unit for the KTD-7 conversion.
 */
@InputType()
export class SaveReceiptScanInput {
  @Field()
  motorcycleId: string;

  /** 'maintenance' | 'expense' (RECORD_TYPES). */
  @Field()
  type: string;

  @Field(() => Float, { nullable: true })
  amount?: number | null;

  @Field(() => String, { nullable: true })
  currency?: string | null;

  @Field(() => String, { nullable: true })
  date?: string | null;

  @Field(() => String, { nullable: true })
  vendor?: string | null;

  @Field(() => String, { nullable: true })
  itemName?: string | null;

  @Field(() => String, { nullable: true })
  category?: string | null;

  @Field(() => Float, { nullable: true })
  partsCost?: number | null;

  @Field(() => Float, { nullable: true })
  laborCost?: number | null;

  /** KTD-7: opt-in odometer write. */
  @Field({ nullable: true })
  applyOdometer?: boolean;

  @Field(() => Float, { nullable: true })
  odometerValue?: number | null;

  /** 'km' | 'mi' (ODOMETER_UNITS) — the unit PRINTED on the receipt. */
  @Field(() => String, { nullable: true })
  odometerUnit?: string | null;
}

/** KTD-7: the guarded odometer write, for a precise undo revert. */
@ObjectType()
export class SavedOdometerRef {
  @Field()
  motorcycleId: string;

  @Field(() => Float, { nullable: true })
  previous?: number | null;

  @Field(() => Float)
  applied: number;
}

/**
 * What the save wrote (mirrors receipt_scans.saved_record_refs). Returned so the
 * client can drive an undo affordance without a second read.
 */
@ObjectType()
export class SavedRecordRefs {
  /** 'expense' | 'maintenance' (RECORD_TYPES). */
  @Field()
  recordType: string;

  @Field(() => String, { nullable: true })
  expenseId?: string | null;

  @Field(() => String, { nullable: true })
  taskId?: string | null;

  @Field(() => String, { nullable: true })
  photoId?: string | null;

  @Field(() => SavedOdometerRef, { nullable: true })
  odometer?: SavedOdometerRef | null;
}

@ObjectType()
export class SaveReceiptScanSuccess {
  @Field()
  scanId: string;

  @Field(() => SavedRecordRefs)
  refs: SavedRecordRefs;
}

export const SaveReceiptScanResult = createUnionType({
  name: 'SaveReceiptScanResult',
  types: () => [SaveReceiptScanSuccess, ReceiptScanError] as const,
  resolveType(value) {
    if ('refs' in value) return SaveReceiptScanSuccess;
    return ReceiptScanError;
  },
});
