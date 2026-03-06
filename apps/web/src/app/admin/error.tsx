'use client';

export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div style={{ padding: 24 }}>
      <h2>Something went wrong</h2>
      <p>{error.message}</p>
      <button
        type="button"
        onClick={reset}
        style={{
          padding: '8px 16px',
          background: '#007AFF',
          color: '#fff',
          borderRadius: 6,
          border: 'none',
          cursor: 'pointer',
          marginTop: 8,
        }}
      >
        Try Again
      </button>
    </div>
  );
}
