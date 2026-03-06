export default function AdminPage() {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>Welcome to the MotoLearn Admin Dashboard</p>
      <div
        style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 16, marginTop: 24 }}
      >
        <div style={{ padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h3>Articles</h3>
          <p>Manage AI-generated content</p>
        </div>
        <div style={{ padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h3>Users</h3>
          <p>View user activity</p>
        </div>
        <div style={{ padding: 24, border: '1px solid #eee', borderRadius: 8 }}>
          <h3>Diagnostics</h3>
          <p>Review diagnostic data</p>
        </div>
      </div>
    </div>
  );
}
