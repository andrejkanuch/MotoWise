import type { Metadata } from 'next';
import Image from 'next/image';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

export const metadata: Metadata = {
  title: 'Shared Maintenance History',
  robots: { index: false, follow: false },
};

const API_URL = process.env.API_URL ?? 'https://motowise.onrender.com/graphql';

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

const STATUS_LABELS: Record<string, string> = {
  completed: 'Done',
  pending: 'Pending',
  in_progress: 'In progress',
  overdue: 'Overdue',
};

// Status is a word in a text-safe ink, never a copper or plate fill
const STATUS_CLASS: Record<string, string> = {
  completed: 'sp-status-done',
  overdue: 'sp-status-overdue',
};

const PRIORITY_LABELS: Record<string, string> = {
  critical: 'Critical priority',
  high: 'High priority',
  medium: 'Medium priority',
  low: 'Low priority',
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString('en-US', {
    timeZone: 'UTC',
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

function Brand() {
  return (
    <div className="sp-brand">
      <a href="/">
        <Image src="/images/marketing/MotoVault.png" alt="" width={28} height={28} />
        MotoVault
      </a>
    </div>
  );
}

function ExpiredView() {
  return (
    <div className="mv-marketing sp">
      <Brand />
      <main className="sp-main sp-main-tall">
        <h1 className="sp-title">This link has expired</h1>
        <p className="sp-prose" style={{ marginTop: 16 }}>
          The rider who shared this service history has stopped sharing it, or the link is no longer
          valid. Ask them for a new one.
        </p>
        <div className="sp-cta-actions">
          <a href="https://motovault.app" className="mv-btn mv-btn-primary">
            Go to MotoVault
          </a>
        </div>
      </main>
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
  const bikeLine = `${bike.year} ${bike.make} ${bike.model}`;
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const pendingTasks = tasks.filter((t) => t.status !== 'completed');

  return (
    <div className="mv-marketing sp">
      <Brand />

      <main className="sp-main sp-main-tall">
        <h1 className="sp-title">{bikeName}</h1>
        <p className="sp-sub">
          {bike.nickname ? `${bikeLine} · ` : ''}Service history, shared {formatDate(generatedAt)}
        </p>

        <div className="sp-figures">
          <div className="sp-figure">
            <span className="sp-figure-value">{tasks.length}</span>
            <span className="sp-figure-label">{tasks.length === 1 ? 'Record' : 'Records'}</span>
          </div>
          <div className="sp-figure">
            <span className="sp-figure-value">{completedTasks.length}</span>
            <span className="sp-figure-label">Done</span>
          </div>
          <div className="sp-figure">
            <span className="sp-figure-value">{pendingTasks.length}</span>
            <span className="sp-figure-label">Still to do</span>
          </div>
        </div>

        <section className="sp-section">
          <h2 className="sp-section-title">Records</h2>
          {tasks.length === 0 ? (
            <p className="sp-prose">No service records yet.</p>
          ) : (
            <ul className="sp-list">
              {tasks.map((task) => {
                const details: string[] = [];
                if (task.dueDate) details.push(`Due ${formatDate(task.dueDate)}`);
                if (task.completedAt) details.push(`Done ${formatDate(task.completedAt)}`);
                if (task.completedMileage != null) {
                  details.push(`at ${task.completedMileage.toLocaleString('en-US')} on the clock`);
                }
                return (
                  <li
                    key={`${task.title}-${task.status}-${task.completedAt ?? task.dueDate ?? ''}`}
                    className="sp-row"
                  >
                    <div className="sp-row-body">
                      <div className="sp-row-title">{task.title}</div>
                      <div className="sp-row-meta">
                        <span className={STATUS_CLASS[task.status]}>
                          {STATUS_LABELS[task.status] ?? task.status}
                        </span>
                        <span>{PRIORITY_LABELS[task.priority] ?? task.priority}</span>
                        {details.map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                      {task.notes && <p className="sp-row-note">{task.notes}</p>}
                      {task.photoUrls.length > 0 && (
                        <div className="sp-photos">
                          {task.photoUrls.map((url) => (
                            // biome-ignore lint/performance/noImgElement: external Supabase storage URLs
                            <img
                              key={url}
                              src={url}
                              alt={`${task.title} service record`}
                              loading="lazy"
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </main>

      <footer className="sp-cta">
        <div className="sp-cta-inner">
          <h2 className="sp-cta-title">Service history that travels with the bike</h2>
          <p className="sp-cta-sub">
            MotoVault keeps every service, part and cost against each bike, and shares the record
            with a link like this one.
          </p>
          <div className="sp-cta-actions">
            <a href="https://motovault.app" className="mv-btn mv-btn-primary">
              Get MotoVault
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
