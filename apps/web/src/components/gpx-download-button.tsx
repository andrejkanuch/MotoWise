'use client';

import { palette } from '@motovault/design-system';
import { Download, Loader2 } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

/** Free-tier monthly GPX export limit (mirrors backend constant) */
const FREE_TIER_LIMIT = 3;

interface GpxDownloadButtonProps {
  routeId: string;
  routeName: string;
  isAuthenticated: boolean;
}

/**
 * GPX Download button with quota awareness and paywall gating.
 *
 * Uses the REST endpoint (GET /routes/:id/export.gpx) for the actual download.
 * Once MOT-178/179 land the GraphQL resolvers, swap to the generated
 * ExportRouteGPX mutation + GetGPXQuotaStatus query for full quota tracking.
 */
export function GpxDownloadButton({ routeId, routeName, isAuthenticated }: GpxDownloadButtonProps) {
  const router = useRouter();
  const [isDownloading, setIsDownloading] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);
  const [remaining, setRemaining] = useState<number | null>(null);
  const [showPaywall, setShowPaywall] = useState(false);

  // Dismiss toast after 3s
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Quota check — once MOT-179 lands, replace with:
  // const { data } = useQuery({ queryKey: ['gpxQuota'], queryFn: () => gqlFetcher(GetGPXQuotaStatusDocument), staleTime: 60_000 })
  // For now, read from localStorage as a client-side approximation.
  useEffect(() => {
    if (!isAuthenticated) return;
    const key = `gpx_exports_${new Date().toISOString().slice(0, 7)}`;
    const used = Number(localStorage.getItem(key) ?? '0');
    setRemaining(Math.max(0, FREE_TIER_LIMIT - used));
  }, [isAuthenticated]);

  const incrementLocalQuota = useCallback(() => {
    const key = `gpx_exports_${new Date().toISOString().slice(0, 7)}`;
    const used = Number(localStorage.getItem(key) ?? '0') + 1;
    localStorage.setItem(key, String(used));
    setRemaining(Math.max(0, FREE_TIER_LIMIT - used));
  }, []);

  const handleClick = useCallback(async () => {
    // Unauthenticated: redirect to login
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }

    // Quota exhausted: show paywall
    if (remaining !== null && remaining <= 0) {
      setShowPaywall(true);
      return;
    }

    // Download GPX via REST endpoint
    setIsDownloading(true);
    try {
      const res = await fetch(`${API_URL}/routes/${routeId}/export.gpx`);
      if (!res.ok) {
        throw new Error(`Export failed (${res.status})`);
      }

      const blob = await res.blob();
      const sanitizedName = routeName
        .replace(/[^a-zA-Z0-9\s-]/g, '')
        .replace(/\s+/g, '-');
      const fileName = `${sanitizedName}-motovault.gpx`;

      // Trigger browser download
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = fileName;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);

      incrementLocalQuota();
      setToast({ message: `Downloaded ${fileName}`, type: 'success' });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download GPX';
      setToast({ message, type: 'error' });
    } finally {
      setIsDownloading(false);
    }
  }, [isAuthenticated, remaining, routeId, routeName, router, incrementLocalQuota]);

  return (
    <div className="relative inline-flex flex-col items-center gap-1">
      <button
        type="button"
        onClick={handleClick}
        disabled={isDownloading}
        className="inline-flex items-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold transition-colors disabled:opacity-60"
        style={{
          backgroundColor: palette.accent500,
          color: palette.white,
        }}
      >
        {isDownloading ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : (
          <Download className="h-4 w-4" />
        )}
        {isDownloading ? 'Exporting...' : 'Download GPX'}
      </button>

      {/* Quota indicator */}
      {isAuthenticated && remaining !== null && (
        <span
          className="text-xs"
          style={{
            color: remaining > 0 ? palette.neutral500 : palette.danger500,
          }}
        >
          {remaining > 0
            ? `${remaining} export${remaining === 1 ? '' : 's'} remaining this month`
            : 'Monthly limit reached'}
        </span>
      )}

      {/* Toast notification */}
      {toast && (
        <div
          className="fixed bottom-6 left-1/2 z-50 -translate-x-1/2 rounded-lg px-4 py-2.5 text-sm font-medium shadow-lg"
          style={{
            backgroundColor: toast.type === 'success' ? palette.success500 : palette.danger500,
            color: palette.white,
          }}
        >
          {toast.message}
        </div>
      )}

      {/* Paywall modal */}
      {showPaywall && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          style={{ backgroundColor: palette.surfaceOverlay }}
        >
          <div
            className="w-full max-w-md rounded-2xl p-6 shadow-xl"
            style={{ backgroundColor: palette.white }}
          >
            <h3
              className="mb-2 text-lg font-bold"
              style={{ color: palette.neutral950 }}
            >
              GPX Export Limit Reached
            </h3>
            <p
              className="mb-6 text-sm"
              style={{ color: palette.neutral600 }}
            >
              You have used all {FREE_TIER_LIMIT} free GPX exports this month. Upgrade to MotoVault
              Pro for unlimited exports and more premium features.
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setShowPaywall(false)}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-medium"
                style={{
                  backgroundColor: palette.neutral100,
                  color: palette.neutral700,
                }}
              >
                Maybe Later
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowPaywall(false);
                  // Once the paywall-modal component exists at this path, integrate it.
                  // For now, redirect to the app store.
                  window.open('https://apps.apple.com/app/motovault/id6745417382', '_blank');
                }}
                className="flex-1 rounded-lg px-4 py-2.5 text-sm font-semibold"
                style={{
                  backgroundColor: palette.accent500,
                  color: palette.white,
                }}
              >
                Upgrade
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
