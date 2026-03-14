'use client';

import { useEffect } from 'react';

export default function ErrorPage({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-neutral-950">
      <h1 className="text-2xl font-bold text-neutral-50">Something went wrong</h1>
      <p className="text-neutral-400">An unexpected error occurred. Please try again.</p>
      {error.digest && <p className="text-xs text-neutral-600">Reference: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        className="px-6 py-3 rounded-full bg-warm-500 text-neutral-950 hover:bg-warm-400 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
