import Link from 'next/link';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 240, padding: 16, borderRight: '1px solid #eee' }}>
        <h2>MotoLearn Admin</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>
            <Link href="/dashboard">Overview</Link>
          </li>
          <li>
            <Link href="/dashboard/articles">Articles</Link>
          </li>
          <li>
            <Link href="/dashboard/users">Users</Link>
          </li>
          <li>
            <Link href="/dashboard/diagnostics">Diagnostics</Link>
          </li>
          <li>
            <Link href="/dashboard/flags">Content Flags</Link>
          </li>
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
