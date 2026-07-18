import { createUnionType, Field, ObjectType } from '@nestjs/graphql';
import { ReceiptScanError } from './receipt-scan-result.dto';

@ObjectType()
export class CancelReceiptScanSuccess {
  @Field()
  scanId: string;

  /** Resulting status — always 'cancelled' on the success arm. */
  @Field()
  status: string;
}

export const CancelReceiptScanResult = createUnionType({
  name: 'CancelReceiptScanResult',
  types: () => [CancelReceiptScanSuccess, ReceiptScanError] as const,
  resolveType(value) {
    if ('status' in value) return CancelReceiptScanSuccess;
    return ReceiptScanError;
  },
});
