import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Shared Maintenance History',
  robots: { index: false, follow: false },
};

const API_URL = process.env.API_URL ?? 'http://localhost:4000/graphql';

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
    completed: 'bg-emerald-100 text-emerald-800',
    pending: 'bg-amber-100 text-amber-800',
    in_progress: 'bg-blue-100 text-blue-800',
    overdue: 'bg-red-100 text-red-800',
  };

  const labels: Record<string, string> = {
    completed: 'Completed',
    pending: 'Pending',
    in_progress: 'In Progress',
    overdue: 'Overdue',
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${colors[status] ?? 'bg-gray-100 text-gray-800'}`}
    >
      {labels[status] ?? status}
    </span>
  );
}

function PriorityIndicator({ priority }: { priority: string }) {
  const colors: Record<string, string> = {
    critical: 'text-red-600',
    high: 'text-orange-600',
    medium: 'text-yellow-600',
    low: 'text-gray-500',
  };

  const labels: Record<string, string> = {
    critical: 'Critical',
    high: 'High',
    medium: 'Medium',
    low: 'Low',
  };

  return (
    <span className={`text-xs font-medium ${colors[priority] ?? 'text-gray-500'}`}>
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
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md text-center">
        <div className="mb-6 text-6xl">🔗</div>
        <h1 className="mb-3 text-2xl font-bold text-gray-900">Link Unavailable</h1>
        <p className="mb-8 text-gray-600">This link has expired or is no longer available.</p>
        <a
          href="https://motowise.app"
          className="inline-flex items-center rounded-lg bg-gray-900 px-6 py-3 text-sm font-medium text-white transition-colors hover:bg-gray-800"
        >
          Visit MotoWise
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
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto max-w-3xl px-4 py-6 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-500">Maintenance History</p>
              <h1 className="mt-1 text-2xl font-bold text-gray-900">{bikeName}</h1>
              <p className="mt-1 text-sm text-gray-500">
                {bike.year} {bike.make} {bike.model}
              </p>
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-400">Generated</p>
              <p className="text-sm text-gray-600">{formatDate(generatedAt)}</p>
            </div>
          </div>

          {/* Summary stats */}
          <div className="mt-6 grid grid-cols-3 gap-4">
            <div className="rounded-lg bg-gray-50 p-3 text-center">
              <p className="text-2xl font-bold text-gray-900">{tasks.length}</p>
              <p className="text-xs text-gray-500">Total Tasks</p>
            </div>
            <div className="rounded-lg bg-emerald-50 p-3 text-center">
              <p className="text-2xl font-bold text-emerald-700">{completedTasks.length}</p>
              <p className="text-xs text-gray-500">Completed</p>
            </div>
            <div className="rounded-lg bg-amber-50 p-3 text-center">
              <p className="text-2xl font-bold text-amber-700">{pendingTasks.length}</p>
              <p className="text-xs text-gray-500">Pending</p>
            </div>
          </div>
        </div>
      </header>

      {/* Task List */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        {tasks.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-gray-500">No maintenance tasks recorded yet.</p>
          </div>
        ) : (
          <div className="space-y-4">
            {tasks.map((task) => (
              <div
                key={`${task.title}-${task.status}-${task.completedAt ?? task.dueDate ?? ''}`}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white shadow-sm"
              >
                <div className="p-4 sm:p-5">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-gray-900">{task.title}</h3>
                      <div className="mt-1.5 flex flex-wrap items-center gap-2">
                        <StatusBadge status={task.status} />
                        <PriorityIndicator priority={task.priority} />
                      </div>
                    </div>
                  </div>

                  {/* Details */}
                  <div className="mt-3 space-y-1.5 text-sm text-gray-600">
                    {task.dueDate && (
                      <p>
                        <span className="font-medium text-gray-700">Due:</span>{' '}
                        {formatDate(task.dueDate)}
                      </p>
                    )}
                    {task.completedAt && (
                      <p>
                        <span className="font-medium text-gray-700">Completed:</span>{' '}
                        {formatDate(task.completedAt)}
                      </p>
                    )}
                    {task.completedMileage != null && (
                      <p>
                        <span className="font-medium text-gray-700">Mileage at completion:</span>{' '}
                        {task.completedMileage.toLocaleString()}
                      </p>
                    )}
                    {task.notes && (
                      <p>
                        <span className="font-medium text-gray-700">Notes:</span> {task.notes}
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
      <footer className="border-t border-gray-200 bg-white py-8">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-sm text-gray-500">
            Powered by{' '}
            <a href="https://motowise.app" className="font-medium text-gray-900 hover:underline">
              MotoWise
            </a>
          </p>
          <p className="mt-1 text-xs text-gray-400">AI-powered motorcycle maintenance tracking</p>
        </div>
      </footer>
    </div>
  );
}
