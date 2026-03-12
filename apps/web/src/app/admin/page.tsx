export default function AdminPage() {
  return (
    <div>
      <h1 className="text-2xl font-bold text-[--color-on-surface] dark:text-neutral-50">
        Dashboard
      </h1>
      <p className="mt-2 text-[--color-on-surface-muted] dark:text-neutral-300">
        Welcome to the MotoVault Admin Dashboard
      </p>
      <div className="grid grid-cols-3 gap-4 mt-6">
        <div className="p-6 border border-[--color-border] dark:border-neutral-700 rounded-[--radius-card] bg-[--color-surface-elevated] dark:bg-neutral-800 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[--color-on-surface] dark:text-neutral-50">Articles</h3>
          <p className="mt-1 text-sm text-[--color-on-surface-muted] dark:text-neutral-400">
            Manage AI-generated content
          </p>
        </div>
        <div className="p-6 border border-[--color-border] dark:border-neutral-700 rounded-[--radius-card] bg-[--color-surface-elevated] dark:bg-neutral-800 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[--color-on-surface] dark:text-neutral-50">Users</h3>
          <p className="mt-1 text-sm text-[--color-on-surface-muted] dark:text-neutral-400">
            View user activity
          </p>
        </div>
        <div className="p-6 border border-[--color-border] dark:border-neutral-700 rounded-[--radius-card] bg-[--color-surface-elevated] dark:bg-neutral-800 hover:shadow-md transition-shadow">
          <h3 className="font-semibold text-[--color-on-surface] dark:text-neutral-50">
            Diagnostics
          </h3>
          <p className="mt-1 text-sm text-[--color-on-surface-muted] dark:text-neutral-400">
            Review diagnostic data
          </p>
        </div>
      </div>
    </div>
  );
}
