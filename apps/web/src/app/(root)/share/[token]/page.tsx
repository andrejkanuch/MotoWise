import type { Metadata } from 'next';
import Image from 'next/image';
import { ShareUnavailable } from '@/components/share-unavailable';
import {
  GRAPHQL_BAD_REQUEST_CODE,
  GRAPHQL_NOT_FOUND_CODE,
  postPublicQuery,
} from '@/lib/public-graphql';
import { asUpstream, settleUpstream } from '@/lib/upstream-error';
import '@/components/marketing/design-system.css';
import '@/components/share-page.css';

// Rendered per request, like /t: an API outage shows ShareUnavailable, and that
// page must never be cached over a good copy. The fetch itself is still cached
// in the data cache, so the API sees at most one call per revalidate window.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Shared service history',
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

/** The resolver rejects a malformed token with BAD_REQUEST: the link is gone. */
const SHARE_ABSENT_CODES = [GRAPHQL_NOT_FOUND_CODE, GRAPHQL_BAD_REQUEST_CODE];
const SHARE_REVALIDATE_SECONDS = 60;

// `null` only when the API answered that the link is gone; anything else
// (network failure, timeout, non-200, another GraphQL error) throws
// `UpstreamError` so the page says "didn't load", not "expired", to a rider
// whose link is fine.
async function fetchSharedHistory(token: string): Promise<SharedBikeHistory | null> {
  const data = await asUpstream(
    postPublicQuery<{ sharedBikeHistory: SharedBikeHistory | null }>(
      API_URL,
      SHARED_BIKE_HISTORY_QUERY,
      { token },
      SHARE_REVALIDATE_SECONDS,
      SHARE_ABSENT_CODES,
    ),
    'shared history',
  );
  return data?.sharedBikeHistory ?? null;
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
        <h1 className="mv-section-title sp-title">This link has expired</h1>
        <p className="sp-prose" style={{ marginTop: 16 }}>
          The rider who shared this service history has stopped sharing it, or the link is no longer
          valid. Ask them for a new one.
        </p>
        <div className="sp-cta-actions">
          <a href="/get" className="mv-btn mv-btn-primary">
            Get the app
          </a>
        </div>
      </main>
    </div>
  );
}

export default async function SharePage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  // undefined = the API never answered (outage), null = the link is gone
  const history = await settleUpstream(fetchSharedHistory(token));

  if (history === undefined) {
    return <ShareUnavailable what="The service history" path={`/share/${token}`} />;
  }
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
        <h1 className="mv-section-title sp-title">{bikeName}</h1>
        <p className="sp-sub">
          {bike.nickname ? `${bikeLine} · ` : ''}Service history, shared {formatDate(generatedAt)}
        </p>

        <div className="sp-figures">
          <div className="sp-figure">
            <span className="mv-figure sp-figure-value">{completedTasks.length}</span>
            <span className="sp-figure-label">Done</span>
          </div>
          <div className="sp-figure">
            <span className="mv-figure sp-figure-value">{pendingTasks.length}</span>
            <span className="sp-figure-label">Still to do</span>
          </div>
        </div>

        <section className="sp-section">
          <h2 className="sp-section-title">Records</h2>
          {tasks.length === 0 ? (
            <p className="sp-prose">No service records yet.</p>
          ) : (
            <ul className="mv-rows">
              {tasks.map((task) => {
                const details: string[] = [];
                if (task.dueDate) details.push(`Due ${formatDate(task.dueDate)}`);
                if (task.completedAt) details.push(`Done ${formatDate(task.completedAt)}`);
                if (task.completedMileage != null) {
                  details.push(
                    `at ${task.completedMileage.toLocaleString('en-US')} on the odometer`,
                  );
                }
                return (
                  <li
                    key={`${task.title}-${task.status}-${task.completedAt ?? task.dueDate ?? ''}`}
                    className="mv-row sp-row"
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
          <h2 className="mv-h2">Service history that travels with the bike</h2>
          <p className="sp-cta-sub">
            MotoVault keeps every service, part and cost against each bike, and shares the record
            with a link like this one.
          </p>
          <div className="sp-cta-actions">
            <a href="/get" className="mv-btn mv-btn-primary">
              Get the app
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
