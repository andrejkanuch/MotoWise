export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      <nav style={{ width: 240, padding: 16, borderRight: '1px solid #eee' }}>
        <h2>MotoLearn Admin</h2>
        <ul style={{ listStyle: 'none', padding: 0 }}>
          <li>
            <a href="/dashboard">Overview</a>
          </li>
          <li>
            <a href="/dashboard/articles">Articles</a>
          </li>
          <li>
            <a href="/dashboard/users">Users</a>
          </li>
          <li>
            <a href="/dashboard/diagnostics">Diagnostics</a>
          </li>
          <li>
            <a href="/dashboard/flags">Content Flags</a>
          </li>
        </ul>
      </nav>
      <main style={{ flex: 1, padding: 24 }}>{children}</main>
    </div>
  );
}
