import Link from 'next/link';

export default function AdminNotFound() {
  return (
    <div style={{ padding: 24 }}>
      <h1>404</h1>
      <p>This admin page does not exist.</p>
      <Link href="/admin">Back to Admin</Link>
    </div>
  );
}
