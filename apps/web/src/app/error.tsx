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
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 16,
      }}
    >
      <h1>Something went wrong</h1>
      <p>An unexpected error occurred. Please try again.</p>
      {error.digest && <p style={{ fontSize: 12, color: '#999' }}>Reference: {error.digest}</p>}
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '12px 24px',
          background: '#007AFF',
          color: '#fff',
          borderRadius: 8,
          border: 'none',
          cursor: 'pointer',
        }}
      >
        Try Again
      </button>
    </div>
  );
}
