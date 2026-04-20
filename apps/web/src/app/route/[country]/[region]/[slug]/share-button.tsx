'use client';

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
  const handleShare = () => {
    if (navigator.share) {
      navigator.share({ title: routeName, url: window.location.href });
    } else {
      navigator.clipboard.writeText(window.location.href);
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
