import { ErrorCode } from '@revenuecat/purchases-js';
import { describe, expect, it } from 'vitest';
import {
  CHECKOUT_FAILURE_REASON,
  describeCheckoutError,
  RC_BACKEND_ERROR,
  RC_SDK_ERROR,
  SUPPORT_EMAIL,
} from '../checkout-errors';

describe('describeCheckoutError', () => {
  it('turns RC 7834 "Email domain is not valid" into an actionable message', () => {
    const failure = describeCheckoutError({
      errorCode: RC_SDK_ERROR.INVALID_EMAIL,
      backendErrorCode: RC_BACKEND_ERROR.NO_MX_RECORDS,
    });
    expect(failure.reason).toBe(CHECKOUT_FAILURE_REASON.INVALID_EMAIL);
    expect(failure.message).toMatch(/email can't be used for billing/);
    expect(failure.message).toMatch(/Profile/);
    expect(failure.message).not.toMatch(/7834/);
  });

  it('prefers the backend code over the SDK code', () => {
    expect(
      describeCheckoutError({
        errorCode: RC_SDK_ERROR.UNKNOWN,
        backendErrorCode: RC_BACKEND_ERROR.ALREADY_SUBSCRIBED,
      }).reason,
    ).toBe(CHECKOUT_FAILURE_REASON.ALREADY_SUBSCRIBED);
  });

  it('maps SDK-only failures', () => {
    const cases: [number, string][] = [
      [RC_SDK_ERROR.NETWORK, CHECKOUT_FAILURE_REASON.NETWORK],
      [RC_SDK_ERROR.PAYMENT_PENDING, CHECKOUT_FAILURE_REASON.PAYMENT_PENDING],
      [RC_SDK_ERROR.PRODUCT_ALREADY_PURCHASED, CHECKOUT_FAILURE_REASON.ALREADY_SUBSCRIBED],
      [RC_SDK_ERROR.STORE_PROBLEM, CHECKOUT_FAILURE_REASON.PAYMENT_DECLINED],
      [RC_SDK_ERROR.PRODUCT_NOT_AVAILABLE, CHECKOUT_FAILURE_REASON.PLAN_UNAVAILABLE],
    ];
    for (const [errorCode, reason] of cases) {
      expect(describeCheckoutError({ errorCode, backendErrorCode: null }).reason).toBe(reason);
    }
  });

  it('falls back to a support message that carries the code', () => {
    const failure = describeCheckoutError({ errorCode: 999, backendErrorCode: 1234 });
    expect(failure.reason).toBe(CHECKOUT_FAILURE_REASON.UNKNOWN);
    expect(failure.message).toContain(SUPPORT_EMAIL);
    expect(failure.message).toContain('(code 1234)');
    expect(describeCheckoutError({ errorCode: null, backendErrorCode: null }).message).not.toMatch(
      /code/,
    );
  });

  it('keeps the SDK error codes in step with @revenuecat/purchases-js', () => {
    expect(RC_SDK_ERROR).toEqual({
      UNKNOWN: ErrorCode.UnknownError,
      USER_CANCELLED: ErrorCode.UserCancelledError,
      STORE_PROBLEM: ErrorCode.StoreProblemError,
      PURCHASE_NOT_ALLOWED: ErrorCode.PurchaseNotAllowedError,
      PURCHASE_INVALID: ErrorCode.PurchaseInvalidError,
      PRODUCT_NOT_AVAILABLE: ErrorCode.ProductNotAvailableForPurchaseError,
      PRODUCT_ALREADY_PURCHASED: ErrorCode.ProductAlreadyPurchasedError,
      NETWORK: ErrorCode.NetworkError,
      PAYMENT_PENDING: ErrorCode.PaymentPendingError,
      INVALID_EMAIL: ErrorCode.InvalidEmailError,
    });
  });
});
