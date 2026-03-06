import Link from 'next/link';

export default function NotFound() {
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
      <h1>404</h1>
      <p>Page not found</p>
      <Link
        href="/"
        style={{
          padding: '12px 24px',
          background: '#007AFF',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Go Home
      </Link>
    </div>
  );
}
