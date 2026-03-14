import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shared Maintenance History',
  robots: { index: false, follow: false },
};

const API_URL = process.env.API_URL ?? 'https://motovault-api.onrender.com/graphql';

const SHARED_BIKE_HISTORY_QUERY = `
  query SharedBikeHistory($token: String!) {
    sharedBikeHistory(token: $token) {
      bike {
        make
        model
        year
        nickname
      }
      tasks {
        title
        status
        priority
        dueDate
        completedAt
        completedMileage
        notes
        photoUrls
      }
      generatedAt
    }
  }
`;

interface SharedBikeInfo {
  make: string;
  model: string;
  year: number;
  nickname?: string;
}

interface SharedTaskInfo {
  title: string;
  status: string;
  priority: string;
  dueDate?: string;
  completedAt?: string;
  completedMileage?: number;
  notes?: string;
  photoUrls: string[];
}

interface SharedBikeHistory {
  bike: SharedBikeInfo;
  tasks: SharedTaskInfo[];
  generatedAt: string;
}

async function fetchSharedHistory(token: string): Promise<SharedBikeHistory | null> {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: SHARED_BIKE_HISTORY_QUERY,
        variables: { token },
      }),
      next: { revalidate: 60 },
    });

    const json = await res.json();
    if (json.errors || !json.data?.sharedBikeHistory) {
      return null;
    }
    return json.data.sharedBikeHistory;
  } catch {
    return null;
  }
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    completed: 'bg-success-500/10 text-success-500',
    pending: 'bg-warning-500/10 text-warning-500',
    in_progress: 'bg-primary-500/10 text-primary-500',
    overdue: 'bg-danger-500/10 text-danger-500',
  };

  const labels: Record<string, string> = {
    completed: 'Completed',
    pending: 'Pending',
    in_progress: 'In Progress',
    overdue: 'Overdue',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-neutral-100 text-neutral-800'}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function PriorityIndicator({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'text-danger-500',
    high: 'text-warning-500',
    medium: 'text-warning-500',
    low: 'text-neutral-500',
  };

  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return (
    <span className={`text-xs font-medium ${colors[priority] ?? 'text-neutral-500'}`}>
      {labels[priority] ?? priority}
    </span>
  );
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function ExpiredView() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-neutral-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-6xl">🔗</div>
        <h1 className="mb-3 text-2xl font-bold text-neutral-900">Link Unavailable</h1>
        <p className="mb-8 text-neutral-600">This link has expired or is no longer available.</p>
        <a
          href="https://motovault.app"
          className="inline-flex items-center rounded-lg bg-neutral-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-neutral-800"
        >
          Visit MotoVault
        </a>
      </div>
    </div>
  );
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const history = await fetchSharedHistory(token);

  if (!history) {
    return <ExpiredView />;
  }

  const { bike, tasks, generatedAt } = history;
  const bikeName = bike.nickname ?? `${bike.year} ${bike.make} ${bike.model}`;
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* Header */}
      <header className="border-b border-neutral-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-neutral-500">Maintenance History</p>
              <h1 className="mt-1 truncate text-2xl font-bold text-neutral-900">{bikeName}</h1>
              <p className="mt-1 text-sm text-neutral-500">
                {bike.year} {bike.make} {bike.model}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-neutral-400">Generated</p>
              <p className="text-sm text-neutral-600">{formatDate(generatedAt)}</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-neutral-50 p-3 text-center">
              <p className="text-2xl font-bold text-neutral-900">{tasks.length}</p>
              <p className="text-xs text-neutral-500">Total Tasks</p>
            </div>
            <div className="rounded-lg bg-success-500/10 p-3 text-center">
              <p className="text-2xl font-bold text-success-500">{completedTasks.length}</p>
              <p className="text-xs text-neutral-500">Completed</p>
            </div>
            <div className="rounded-lg bg-warning-500/10 p-3 text-center">
              <p className="text-2xl font-bold text-warning-500">{pendingTasks.length}</p>
              <p className="text-xs text-neutral-500">Pending</p>
            </div>
          </div>
        </div>
      </header>

      {/* Task List */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {tasks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-neutral-500">No maintenance tasks recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={`${task.title}-${task.status}-${task.completedAt ?? task.dueDate ?? ''}`}
                className="overflow-hidden rounded-lg border border-neutral-200 bg-white shadow-sm"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="truncate font-semibold text-neutral-900">{task.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} />
                        <PriorityIndicator priority={task.priority} />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-1.5 text-sm text-neutral-600">
                    {task.dueDate && (
                      <p>
                        <span className="font-medium text-neutral-700">Due:</span>{' '}
                        {formatDate(task.dueDate)}
                      </p>
                    )}
                    {task.completedAt && (
                      <p>
                        <span className="font-medium text-neutral-700">Completed:</span>{' '}
                        {formatDate(task.completedAt)}
                      </p>
                    )}
                    {task.completedMileage != null && (
                      <p>
                        <span className="font-medium text-neutral-700">Mileage at completion:</span>{' '}
                        {task.completedMileage.toLocaleString()}
                      </p>
                    )}
                    {task.notes && (
                      <p>
                        <span className="font-medium text-neutral-700">Notes:</span>{' '}
                        <span className="line-clamp-3">{task.notes}</span>
                      </p>
                    )}
                  </div>

                  {/* Photos */}
                  {task.photoUrls.length > 0 && (
                    <div className="mt-4 flex gap-2 overflow-x-auto">
                      {task.photoUrls.map((url) => (
                        // biome-ignore lint/performance/noImgElement: external Supabase storage URLs
                        <img
                          key={url}
                          src={url}
                          alt={`${task.title} maintenance record`}
                          className="h-20 w-20 flex-shrink-0 rounded-lg object-cover"
                          loading="lazy"
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-200 bg-white py-8">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-sm text-neutral-500">
            Powered by{' '}
            <a
              href="https://motovault.app"
              className="font-medium text-neutral-900 hover:underline"
            >
              MotoVault
            </a>
          </p>
          <p className="mt-1 text-xs text-neutral-400">
            AI-powered motorcycle maintenance tracking
          </p>
        </div>
      </footer>
    </div>
  );
}
