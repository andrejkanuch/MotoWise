'use client';

export default function ErrorPage({
  error,
  reset,
}: {
  error: globalThis.Error & { digest?: string };
  reset: () => void;
}) {
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
      <p>{error.message}</p>
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
