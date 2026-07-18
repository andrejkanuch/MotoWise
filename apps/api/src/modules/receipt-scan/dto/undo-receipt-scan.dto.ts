import { createUnionType, Field, ObjectType } from '@nestjs/graphql';
import { ReceiptScanError } from './receipt-scan-result.dto';

@ObjectType()
export class UndoReceiptScanSuccess {
  @Field()
  scanId: string;

  /** 'reverted' | 'nothing_to_undo' (UNDO_STATUS). Both are idempotent success. */
  @Field()
  status: string;
}

export const UndoReceiptScanResult = createUnionType({
  name: 'UndoReceiptScanResult',
  types: () => [UndoReceiptScanSuccess, ReceiptScanError] as const,
  resolveType(value) {
    if ('status' in value) return UndoReceiptScanSuccess;
    return ReceiptScanError;
  },
});
