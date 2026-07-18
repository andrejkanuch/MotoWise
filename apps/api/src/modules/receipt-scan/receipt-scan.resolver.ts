import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CancelReceiptScanResult } from './dto/receipt-scan-cancel.dto';
import { ReceiptScanQuota } from './dto/receipt-scan-quota.dto';
import { ReceiptScanResult } from './dto/receipt-scan-result.dto';
import { UnreviewedScan } from './dto/unreviewed-scan.dto';
import { ReceiptScanService } from './receipt-scan.service';

@Resolver()
export class ReceiptScanResolver {
  constructor(private readonly receiptScanService: ReceiptScanService) {}

  // scanId is validated as a strict UUID INSIDE the service (returns the
  // IMAGE_INVALID union error, not a thrown 400) — so NO ParseUUIDPipe here.
  @UseGuards(GqlThrottlerGuard)
  @Throttle({ default: THROTTLE_PRESETS.RECEIPT_SCAN })
  @Mutation(() => ReceiptScanResult)
  async scanReceipt(
    @CurrentUser() user: AuthUser,
    @Args('scanId') scanId: string,
  ): Promise<typeof ReceiptScanResult> {
    return this.receiptScanService.scanReceipt(user, scanId);
  }

  @Mutation(() => CancelReceiptScanResult)
  async cancelReceiptScan(
    @CurrentUser() user: AuthUser,
    @Args('scanId') scanId: string,
  ): Promise<typeof CancelReceiptScanResult> {
    return this.receiptScanService.cancelReceiptScan(user, scanId);
  }

  @Query(() => ReceiptScanQuota)
  async receiptScanQuota(@CurrentUser() user: AuthUser): Promise<ReceiptScanQuota> {
    return this.receiptScanService.receiptScanQuota(user);
  }

  @Query(() => [UnreviewedScan])
  async unreviewedReceiptScans(@CurrentUser() user: AuthUser): Promise<UnreviewedScan[]> {
    return this.receiptScanService.unreviewedReceiptScans(user);
  }
}
