'use client';

interface ShareButtonProps {
  routeName: string;
  variant?: 'icon' | 'full';
}

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
        className="flex w-full items-center justify-center gap-2 rounded-xl border border-neutral-700 px-4 py-3 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-800"
        onClick={handleShare}
      >
        <ShareIcon />
        Copy Link
      </button>
    );
  }

  return (
    <button
      type="button"
      className="flex items-center gap-2 rounded-xl bg-neutral-800/80 px-3.5 py-2.5 text-sm font-medium text-neutral-200 backdrop-blur-sm transition-colors hover:bg-neutral-700/80"
      onClick={handleShare}
    >
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
