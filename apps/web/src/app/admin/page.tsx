export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-50">Dashboard</h1>
      <p className="mt-2 text-neutral-400">Welcome to the MotoVault Admin Dashboard</p>
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-6 border border-neutral-800 rounded-2xl bg-neutral-900 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-neutral-50">Articles</h3>
          <p className="mt-1 text-sm text-neutral-400">Manage AI-generated content</p>
        </div>
        <div className="p-6 border border-neutral-800 rounded-2xl bg-neutral-900 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-neutral-50">Users</h3>
          <p className="mt-1 text-sm text-neutral-400">View user activity</p>
        </div>
        <div className="p-6 border border-neutral-800 rounded-2xl bg-neutral-900 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-neutral-50">Diagnostics</h3>
          <p className="mt-1 text-sm text-neutral-400">Review diagnostic data</p>
        </div>
      </div>
    </div>
  );
}
