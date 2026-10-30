'use client';

import { AlertCircle, Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthModal } from '@/components/auth-modal';
import { useModal } from '@/hooks/use-modal';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';
import './gpx-download-button.css';

const EXPORT_MUTATION = /* GraphQL */ `
  mutation ExportTripGPX($country: String!, $region: String!, $slug: String!) {
    exportTripGPX(country: $country, region: $region, slug: $slug) {
      ... on GPXExportSuccess {
        fileUrl
        fileName
        message
      }
      ... on GPXExportError {
        code
        reason
        quotaRemaining
        upgradeUrl
      }
    }
  }
` as never;

const QUOTA_QUERY = /* GraphQL */ `
  query GetGPXQuotaStatus {
    getGPXQuotaStatus {
      remaining
      limit
      isExhausted
    }
  }
` as never;

interface QuotaData {
  getGPXQuotaStatus: { remaining: number; limit: number; isExhausted: boolean };
}

interface ExportData {
  exportTripGPX:
    | { fileUrl: string; fileName: string; message: string }
    | { code: string; reason: string; quotaRemaining?: number; upgradeUrl?: string };
}

interface GpxDownloadButtonProps {
  country: string;
  region: string;
  slug: string;
  routeName: string;
}

/**
 * The one GPX control on a trip page: a ghost button in the hero's action row,
 * with the signed-in rider's quota beside it. Signed-out riders get the auth
 * modal; an exhausted quota gets the Pro dialog.
 */
export function GpxDownloadButton({ country, region, slug, routeName }: GpxDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user);
    });
  }, []);

  // Dismiss toast after 3s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Fetch quota status (only when authenticated)
  useEffect(() => {
    if (!isAuthenticated) return;
    gqlFetcher<QuotaData, Record<string, never>>(QUOTA_QUERY)
      .then((data) => setRemaining(data.getGPXQuotaStatus.remaining))
      .catch(() => {});
  }, [isAuthenticated]);

  const handleClick = useCallback(async () => {
    if (!isAuthenticated) {
      setShowAuthModal(true);
      return;
    }

    if (remaining !== null && remaining === 0) {
      setShowPaywall(true);
      return;
    }

    setIsDownloading(true);
    try {
      const data = await gqlFetcher<ExportData, { country: string; region: string; slug: string }>(
        EXPORT_MUTATION,
        { country, region, slug },
      );
      const result = data.exportTripGPX;

      if ('code' in result) {
        if (result.code === 'QUOTA_EXCEEDED') {
          setShowPaywall(true);
          setRemaining(0);
        } else {
          setToast({ message: result.reason, type: 'error' });
        }
        return;
      }

      await saveFile(result.fileUrl, result.fileName);

      if (remaining !== null && remaining > 0) {
        setRemaining(remaining - 1);
      }

      trackEvent(WebEvent.GPX_DOWNLOAD_CLICKED, {
        trip_slug: slug,
        trip_country: country,
        trip_region: region,
      });
      setToast({ message: result.message, type: 'success' });
    } catch (err) {
      const errMsg = err instanceof Error ? err.message : String(err);
      if (errMsg.includes('authorization') || errMsg.includes('UNAUTHENTICATED')) {
        setShowAuthModal(true);
        return;
      }
      setToast({ message: "The GPX file didn't download. Try again.", type: 'error' });
    } finally {
      setIsDownloading(false);
    }
  }, [isAuthenticated, remaining, country, region, slug]);

  // Re-check auth after auth modal closes (user may have signed in)
  const handleAuthModalClose = useCallback(() => {
    setShowAuthModal(false);
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setIsAuthenticated(true);
      }
    });
  }, []);

  const onPaywallClose = useCallback(() => setShowPaywall(false), []);

  const returnUrl = `/trips/${country}/${region}/${slug}`;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        disabled={isDownloading}
        className="mv-btn mv-btn-ghost"
        aria-busy={isDownloading || undefined}
        aria-label={`Download GPX for ${routeName}`}
      >
        {isDownloading ? (
          <Loader2 size={16} className="gpx-spin" aria-hidden="true" />
        ) : (
          <Download size={16} aria-hidden="true" />
        )}
        {isDownloading ? 'Exporting…' : 'Download GPX'}
      </button>
      {isAuthenticated && remaining !== null && (
        <span
          className="gpx-quota"
          data-exhausted={remaining === 0 ? 'true' : undefined}
          role="status"
        >
          {quotaLabel(remaining)}
        </span>
      )}
      <AuthModal open={showAuthModal} onClose={handleAuthModalClose} action="download GPX" />
      {showPaywall && <PaywallDialog onClose={onPaywallClose} returnUrl={returnUrl} />}
      <Toast toast={toast} />
    </>
  );
}

function quotaLabel(remaining: number): string {
  if (remaining === -1) return 'Unlimited exports with Pro';
  if (remaining > 0) return `${remaining} export${remaining === 1 ? '' : 's'} remaining`;
  return 'Monthly limit reached';
}

/**
 * Save the exported file. The storage URL is fetched into a blob so the browser
 * honours the file name; when that fetch is refused (a CORS-blocked bucket, a
 * network error) the file is opened directly instead of failing with a toast.
 */
async function saveFile(fileUrl: string, fileName: string): Promise<void> {
  let blob: Blob;
  try {
    const res = await fetch(fileUrl);
    if (!res.ok) throw new Error(`Download failed (${res.status})`);
    blob = await res.blob();
  } catch {
    window.open(fileUrl, '_blank', 'noopener');
    return;
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Shared sub-components ──

function Toast({ toast }: { toast: { message: string; type: 'success' | 'error' } | null }) {
  if (!toast) return null;
  // The text stays ink on the raised toast (overdue ink fails 3:1 there); the
  // failure is said by the icon in overdue ink plus the sentence itself.
  return (
    <div className="gpx-toast mv-enter-up" data-type={toast.type} role="status">
      {toast.type === 'error' && (
        <AlertCircle size={16} className="gpx-toast-mark" aria-hidden="true" />
      )}
      {toast.message}
    </div>
  );
}

/** The quota dialog: focus moves in, Tab cycles inside, Escape and the scrim close it. */
function PaywallDialog({ onClose, returnUrl }: { onClose: () => void; returnUrl: string }) {
  const dialogRef = useRef<HTMLDivElement>(null);
  useModal(true, onClose, dialogRef);

  return (
    <div
      className="gpx-scrim"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      // Escape is handled by useModal; the scrim itself is not a focus target.
      onKeyDown={() => {}}
      role="dialog"
      aria-modal="true"
      aria-labelledby="gpx-paywall-title"
    >
      <div ref={dialogRef} tabIndex={-1} className="gpx-dialog mv-enter-up">
        <h3 id="gpx-paywall-title" className="mv-h3">
          GPX export limit reached
        </h3>
        <p className="gpx-dialog-body">
          You&apos;ve used this month&apos;s free GPX exports. MotoVault Pro has no export limit.
        </p>
        <div className="gpx-dialog-actions">
          <button type="button" onClick={onClose} className="mv-btn mv-btn-ghost">
            Maybe later
          </button>
          <button
            type="button"
            onClick={() => {
              onClose();
              window.location.href = `/pro/checkout?redirect=${encodeURIComponent(returnUrl)}`;
            }}
            className="mv-btn mv-btn-primary"
          >
            Get MotoVault Pro
          </button>
        </div>
      </div>
    </div>
  );
}
