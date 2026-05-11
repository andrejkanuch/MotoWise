'use client';

import { palette } from '@motovault/design-system';
import { Download, Loader2 } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { AuthModal } from '@/components/auth-modal';
import { trackEvent, WebEvent } from '@/lib/analytics';
import { gqlFetcher } from '@/lib/graphql-client';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

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
  /** Visual variant: "hero" = compact icon style, "map" = accent bar, "bottom" = full section */
  variant?: 'hero' | 'map' | 'bottom';
}

export function GpxDownloadButton({
  country,
  region,
  slug,
  routeName,
  variant = 'map',
}: GpxDownloadButtonProps) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [authChecked, setAuthChecked] = useState(false);
  const [showPaywall, setShowPaywall] = useState(false);
  const [showAuthModal, setShowAuthModal] = useState(false);

  // Check auth status on mount
  useEffect(() => {
    const supabase = getSupabaseBrowserClient();
    supabase.auth.getSession().then(({ data: { session } }) => {
      setIsAuthenticated(!!session?.user);
      setAuthChecked(true);
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

      const res = await fetch(result.fileUrl);
      if (!res.ok) throw new Error(`Download failed (${res.status})`);

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

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
      setToast({ message: errMsg || 'Failed to download GPX', type: 'error' });
    } finally {
      setIsDownloading(false);
    }
  }, [isAuthenticated, remaining, country, region, slug]);

  const paywallDialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!showAuthModal && !showPaywall) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setShowAuthModal(false);
        setShowPaywall(false);
      }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [showAuthModal, showPaywall]);

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

  const returnUrl = `/trips/${country}/${region}/${slug}`;

  // ── Render variants ──

  if (variant === 'hero') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isDownloading}
          className="rh-icon-btn"
          aria-label={`Download GPX for ${routeName}`}
        >
          {isDownloading ? (
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
          ) : (
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <title>Download GPX</title>
              <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
          {isDownloading ? 'Exporting...' : 'Download GPX'}
        </button>
        <Modals
          showAuthModal={showAuthModal}
          showPaywall={showPaywall}
          onAuthClose={handleAuthModalClose}
          onPaywallClose={() => setShowPaywall(false)}
          returnUrl={returnUrl}
          paywallDialogRef={paywallDialogRef}
        />
        <Toast toast={toast} />
      </>
    );
  }

  if (variant === 'map') {
    return (
      <>
        <button
          type="button"
          onClick={handleClick}
          disabled={isDownloading}
          aria-label={`Download GPX for ${routeName}`}
          className="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
          style={{ backgroundColor: palette.accent500, color: palette.white }}
        >
          {isDownloading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Download className="h-4 w-4" />
          )}
          {isDownloading ? 'Exporting...' : 'Download GPX'}
        </button>
        <Modals
          showAuthModal={showAuthModal}
          showPaywall={showPaywall}
          onAuthClose={handleAuthModalClose}
          onPaywallClose={() => setShowPaywall(false)}
          returnUrl={returnUrl}
          paywallDialogRef={paywallDialogRef}
        />
        <Toast toast={toast} />
      </>
    );
  }

  // variant === 'bottom'
  return (
    <>
      <section className="rsec">
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 8,
            padding: '24px 0',
          }}
        >
          <button
            type="button"
            onClick={handleClick}
            disabled={isDownloading}
            aria-label={`Download GPX for ${routeName}`}
            className="inline-flex items-center gap-2 rounded-xl px-5 py-3 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97] disabled:opacity-60"
            style={{ backgroundColor: palette.accent500, color: palette.white }}
          >
            {isDownloading ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Download className="h-4 w-4" />
            )}
            {isDownloading ? 'Exporting...' : 'Download GPX'}
          </button>
          {authChecked && isAuthenticated && remaining !== null && (
            <span
              className="text-[11px] leading-none"
              style={{
                color: remaining === -1 || remaining > 0 ? palette.neutral500 : palette.danger500,
              }}
            >
              {remaining === -1
                ? 'Unlimited exports with Pro'
                : remaining > 0
                  ? `${remaining} export${remaining === 1 ? '' : 's'} remaining`
                  : 'Monthly limit reached'}
            </span>
          )}
        </div>
      </section>
      <Modals
        showAuthModal={showAuthModal}
        showPaywall={showPaywall}
        onAuthClose={handleAuthModalClose}
        onPaywallClose={() => setShowPaywall(false)}
        returnUrl={returnUrl}
        paywallDialogRef={paywallDialogRef}
      />
      <Toast toast={toast} />
    </>
  );
}

// ── Shared sub-components ──

function Toast({ toast }: { toast: { message: string; type: 'success' | 'error' } | null }) {
  if (!toast) return null;
  return (
    <div
      className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 animate-[fadeInUp_200ms_ease-out] rounded-xl px-4 py-2.5 text-sm font-medium shadow-lg"
      style={{
        backgroundColor: toast.type === 'success' ? palette.success500 : palette.danger500,
        color: palette.white,
      }}
    >
      {toast.message}
    </div>
  );
}

function Modals({
  showAuthModal,
  showPaywall,
  onAuthClose,
  onPaywallClose,
  returnUrl,
  paywallDialogRef,
}: {
  showAuthModal: boolean;
  showPaywall: boolean;
  onAuthClose: () => void;
  onPaywallClose: () => void;
  returnUrl: string;
  paywallDialogRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <>
      <AuthModal open={showAuthModal} onClose={onAuthClose} action="download GPX" />
      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 animate-[fadeIn_150ms_ease-out]"
          style={{ backgroundColor: palette.surfaceOverlay }}
          onClick={(e) => {
            if (e.target === e.currentTarget) onPaywallClose();
          }}
          onKeyDown={() => {}}
          role="dialog"
          aria-modal="true"
          aria-label="Export limit reached"
        >
          <div
            ref={paywallDialogRef}
            className="w-full max-w-md rounded-2xl border p-6 shadow-2xl animate-[scaleIn_200ms_ease-out]"
            style={{ backgroundColor: palette.neutral950, borderColor: palette.neutral800 }}
          >
            <h3 className="mb-2 text-lg font-bold" style={{ color: palette.neutral50 }}>
              GPX export limit reached
            </h3>
            <p className="mb-6 text-sm leading-relaxed" style={{ color: palette.neutral400 }}>
              You&apos;ve used all your free GPX exports this month. Upgrade to MotoVault Pro for
              unlimited exports and more premium features.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={onPaywallClose}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-medium transition-colors hover:bg-neutral-700"
                style={{ backgroundColor: palette.neutral800, color: palette.neutral300 }}
              >
                Maybe Later
              </button>
              <button
                type="button"
                onClick={() => {
                  onPaywallClose();
                  window.location.href = `/pro/checkout?redirect=${encodeURIComponent(returnUrl)}`;
                }}
                className="flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all hover:brightness-110 active:scale-[0.97]"
                style={{ backgroundColor: palette.accent500, color: palette.white }}
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
