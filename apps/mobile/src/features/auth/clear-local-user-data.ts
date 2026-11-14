import { clearSheetDrafts } from '../../components/bike-hub/notes/unattached-note-photos';
import { AnalyticsEvent, addBreadcrumb, trackEvent } from '../../lib/analytics';
import { SIGNOUT_UNSYNCED_MESSAGE, SIGNOUT_UNSYNCED_SOURCE } from '../../lib/auth-state-change';
import { cancelAllNotifications } from '../../lib/notifications';
import { clearLastUserId } from '../../lib/persisted-query-provider';
import { queryClient } from '../../lib/query-client';
import { clearPersistedQueryCache } from '../../lib/query-persist';
import { clearAllWidgets } from '../../lib/widget-sync';
import { useOnboardingStore } from '../../stores/onboarding.store';
import { rideMMKV } from '../../utils/ride-storage';
import {
  clearDeliveredQueue,
  getPendingCount,
  hasPendingSyncWork,
} from '../../utils/ride-sync-queue';
import { clearParkedScans } from '../receipt-scan/parked-scan-store';
import { clearAllReceiptSaveUndo } from '../receipt-scan/receipt-scan-undo-store';
import { clearScanConsent } from '../receipt-scan/scan-preferences';

/**
 * Clears this device's data for the signed-out user. The root layout's auth
 * listener runs it on a null session after a user existed (decideAuthStateChange
 * `shouldClearLocalData`): by the per-mount ref OR the persisted signal (todo
 * 188), so a server-revoked session that only surfaces on the next cold start
 * still clears it. Moved out of app/_layout.tsx unchanged (issue 365 T15).
 */
export function clearLocalUserData(): void {
  queryClient.clear();
  clearPersistedQueryCache();
  clearLastUserId();
  // Preserve unsynced rides across a forced sign-out / token revocation:
  // keep the sync queue AND the active ride's local data while a ride is
  // in progress or ops are still pending, so they drain once auth is
  // restored instead of silently vanishing.
  //
  // Safe on a shared device because the ride queue is owner-scoped: each
  // op carries the `userId` that enqueued it and `isOwnedByCurrentSession`
  // refuses to drain anyone else's. It did NOT used to be — the backend
  // does not reject a cross-owner `startRide` (it stamps `user_id` from
  // whatever JWT presents it), so what the earlier note here described as
  // a dead-lettered edge case was in fact rider A's GPS track being
  // written into rider B's account.
  // `hasPendingSyncWork()`, NOT `getQueueLength()`. The old guard counted
  // only the main queue, which is empty precisely when every op has already
  // been dead-lettered — so the branch meant to PRESERVE unsynced rides
  // instead ran `clearAll`, removing DEAD_LETTER_KEY and destroying them.
  // Its warning never fired either, being gated on the same wrong counter.
  // And `clearDeliveredQueue` can no longer touch the dead-letter queue even
  // if this condition is ever wrong again.
  const activeRideId = rideMMKV.getCurrentId();
  if (!hasPendingSyncWork() && activeRideId == null) {
    clearDeliveredQueue();
  } else {
    // Intentional data-preservation path (a ride was active or ops were
    // still queued/dead-lettered when a null session was observed —
    // server-forced OR user-initiated sign-out), not a crash. A
    // breadcrumb, NOT captureMessage: Sentry has no non-issue message
    // destination, so `level: 'warning'` only recoloured the badge while
    // the signal still sat under `is:unresolved` — and the synthetic
    // stacktrace split one string across two issues besides.
    // (MOTO-VAULT-REACT-NATIVE-2T / -39)
    addBreadcrumb(SIGNOUT_UNSYNCED_MESSAGE, SIGNOUT_UNSYNCED_SOURCE, {
      pendingCount: getPendingCount(),
      hasActiveRide: activeRideId != null,
    });
    trackEvent(AnalyticsEvent.SIGNOUT_WITH_UNSYNCED_DATA, {
      pending_count: getPendingCount(),
      has_active_ride: activeRideId != null,
    });
  }
  cancelAllNotifications();
  clearAllWidgets();
  // Receipt-scan local surfaces are per-user and device-global: wipe the
  // parked-scan store, the post-save undo store, and the first-scan AI
  // consent flag so a second rider on a shared device never inherits the
  // previous account's scans/undo or skips the consent disclosure. The
  // offline queue is intentionally preserved (its drain is owner-scoped)
  // so a signed-out user's pending captures still upload on their return.
  clearParkedScans();
  clearAllReceiptSaveUndo();
  clearScanConsent();
  // The onboarding run (answers, resume point, garage_first hold and the
  // completion marker) belongs to the account that made it. Kept, the next
  // account on this device resumed at the last screen with the previous
  // rider's answers and skipped onboarding and its paywall.
  useOnboardingStore.getState().resetForSignOut();
  // The Get Started card is NOT reset here: it is owner-keyed, so the same
  // rider signing back in keeps it (a server-onboarded account never re-runs
  // `initialize`, so a reset lost it for good), and `claimForUser` in the
  // session branch resets it when a different account signs in.
  // Note/Odometer work a drag-down parked belongs to the session that wrote it.
  // Store-only: a user sign-out released its photos before the session ended
  // (`releaseSheetDraftsForSignOut`); a forced one cannot, so they stay.
  clearSheetDrafts();
}
