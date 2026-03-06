import Link from 'next/link';

export default function Home() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        gap: 24,
      }}
    >
      <h1>MotoLearn</h1>
      <p>AI-powered motorcycle learning &amp; diagnostics platform</p>
      <Link
        href="/login"
        style={{
          padding: '12px 24px',
          background: '#007AFF',
          color: '#fff',
          borderRadius: 8,
          textDecoration: 'none',
        }}
      >
        Sign In
      </Link>
    </div>
  );
}
