import { SaveReceiptScanInputSchema } from '@motovault/types';
import { UseGuards } from '@nestjs/common';
import { Args, Mutation, Query, Resolver } from '@nestjs/graphql';
import { Throttle } from '@nestjs/throttler';
import type { AuthUser } from '../../common/decorators/current-user.decorator';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { GqlThrottlerGuard } from '../../common/guards/gql-throttler.guard';
import { ZodValidationPipe } from '../../common/pipes/zod-validation.pipe';
import { THROTTLE_PRESETS } from '../../config/constants';
import { CancelReceiptScanResult } from './dto/receipt-scan-cancel.dto';
import { ReceiptScanQuota } from './dto/receipt-scan-quota.dto';
import { ReceiptScanResult } from './dto/receipt-scan-result.dto';
import { SaveReceiptScanInput, SaveReceiptScanResult } from './dto/save-receipt-scan.dto';
import { UndoReceiptScanResult } from './dto/undo-receipt-scan.dto';
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
    // KTD-10: the first onboarding scan is quota-exempt. Client-supplied; the RPC
    // caps it to one per user, so a modified client cannot farm free scans.
    @Args('isOnboarding', { nullable: true }) isOnboarding?: boolean,
  ): Promise<typeof ReceiptScanResult> {
    return this.receiptScanService.scanReceipt(user, scanId, isOnboarding ?? false);
  }

  @Mutation(() => CancelReceiptScanResult)
  async cancelReceiptScan(
    @CurrentUser() user: AuthUser,
    @Args('scanId') scanId: string,
  ): Promise<typeof CancelReceiptScanResult> {
    return this.receiptScanService.cancelReceiptScan(user, scanId);
  }

  // scanId validated as a strict UUID INSIDE the service (returns the union
  // SCAN_NOT_REVIEWABLE error, not a thrown 400).
  @Mutation(() => SaveReceiptScanResult)
  async saveReceiptScan(
    @CurrentUser() user: AuthUser,
    @Args('scanId') scanId: string,
    // Validate the runtime input against the shared Zod contract before it reaches
    // the expense/maintenance write path (decorators/TS types don't validate values).
    @Args('input', new ZodValidationPipe(SaveReceiptScanInputSchema))
    input: SaveReceiptScanInput,
  ): Promise<typeof SaveReceiptScanResult> {
    return this.receiptScanService.saveReceiptScan(user, scanId, input);
  }

  @Mutation(() => UndoReceiptScanResult)
  async undoReceiptScanSave(
    @CurrentUser() user: AuthUser,
    @Args('scanId') scanId: string,
  ): Promise<typeof UndoReceiptScanResult> {
    return this.receiptScanService.undoReceiptScanSave(user, scanId);
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
