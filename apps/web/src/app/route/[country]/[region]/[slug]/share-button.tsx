'use client';

import { trackEvent, WebEvent } from '@/lib/analytics';

interface ShareButtonProps {
  routeName: string;
  variant?: 'icon' | 'full';
}

const iconBtnStyle: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 8,
  padding: '13px 16px',
  borderRadius: 12,
  background: 'oklch(1 0 0 / 0.04)',
  border: '1px solid oklch(1 0 0 / 0.07)',
  color: 'oklch(0.98 0.006 80)',
  fontFamily: 'inherit',
  fontSize: 13,
  fontWeight: 500,
  textDecoration: 'none',
  cursor: 'pointer',
  backdropFilter: 'blur(12px)',
  transition: 'all .2s',
  letterSpacing: '-0.005em',
};

export function ShareButton({ routeName, variant = 'icon' }: ShareButtonProps) {
  const handleShare = async () => {
    trackEvent(WebEvent.SHARE_BUTTON_CLICKED, { source: 'route_detail' });
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: routeName, url });
        return;
      } catch (err) {
        // User dismissed the OS share sheet — nothing to recover from.
        if (err instanceof DOMException && err.name === 'AbortError') return;
        // Any other failure (e.g. SecurityError in a restricted webview) falls
        // through to the clipboard as a best-effort fallback.
      }
    }
    try {
      await navigator.clipboard?.writeText(url);
    } catch {
      // Clipboard blocked (insecure context / permissions). Give up silently
      // rather than surface an unhandled rejection.
    }
  };

  if (variant === 'full') {
    return (
      <button
        type="button"
        style={{
          ...iconBtnStyle,
          width: '100%',
          justifyContent: 'center',
        }}
        onClick={handleShare}
      >
        <ShareIcon />
        Copy Link
      </button>
    );
  }

  return (
    <button type="button" style={iconBtnStyle} onClick={handleShare}>
      <ShareIcon />
      Share
    </button>
  );
}

function ShareIcon() {
  return (
    <svg
      width="16"
      height="16"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <title>Share</title>
      <path d="M4 12v8a2 2 0 002 2h12a2 2 0 002-2v-8M16 6l-4-4-4 4M12 2v13" />
    </svg>
  );
}
