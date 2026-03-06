import type { Metadata } from 'next';
import Link from 'next/link';
import { SignOutButton } from './sign-out-button';

export const metadata: Metadata = {
  title: 'Admin',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav
        style={{
          width: 240,
          padding: 16,
          borderRight: '1px solid #eee',
          display: 'flex',
          flexDirection: 'column',
        }}
      >
        <h2>MotoLearn Admin</h2>
        <ul style={{ listStyle: 'none', padding: 0, flex: 1 }}>
          <li>
            <Link href="/admin">Overview</Link>
          </li>
          <li>
            <Link href="/admin/articles">Articles</Link>
          </li>
          <li>
            <Link href="/admin/users">Users</Link>
          </li>
          <li>
            <Link href="/admin/diagnostics">Diagnostics</Link>
          </li>
          <li>
            <Link href="/admin/flags">Content Flags</Link>
          </li>
        </ul>
        <SignOutButton />
      </nav>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
