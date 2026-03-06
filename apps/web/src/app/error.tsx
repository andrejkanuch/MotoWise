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
    <div className="flex flex-col items-center justify-center min-h-screen gap-4 bg-[--color-surface] dark:bg-neutral-900">
      <h1 className="text-2xl font-bold text-[--color-on-surface] dark:text-neutral-50">
        Something went wrong
      </h1>
      <p className="text-[--color-on-surface-muted] dark:text-neutral-300">
        An unexpected error occurred. Please try again.
      </p>
      {error.digest && (
        <p className="text-xs text-neutral-400 dark:text-neutral-500">
          Reference: {error.digest}
        </p>
      )}
      <button
        type="button"
        onClick={reset}
        className="px-6 py-3 bg-primary-500 text-white rounded-[--radius-button] border-none cursor-pointer hover:bg-primary-600 transition-colors"
      >
        Try Again
      </button>
    </div>
  );
}
