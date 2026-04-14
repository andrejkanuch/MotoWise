import { palette } from '@motovault/design-system';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';

function getSupabaseAdmin(): SupabaseClient | null {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

async function getSignupsByDay(supabaseAdmin: SupabaseClient) {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data } = await supabaseAdmin
    .from('users')
    .select('created_at')
    .gte('created_at', thirtyDaysAgo.toISOString())
    .order('created_at', { ascending: true });

  const grouped: Record<string, number> = {};
  for (const row of data ?? []) {
    const day = row.created_at.slice(0, 10);
    grouped[day] = (grouped[day] ?? 0) + 1;
  }
  return grouped;
}

async function getRouteEngagement(supabaseAdmin: SupabaseClient) {
  const { data } = await supabaseAdmin
    .from('routes')
    .select('rating_count, comment_count')
    .eq('status', 'published');

  let totalRatings = 0;
  let totalComments = 0;
  const totalRoutes = data?.length ?? 0;

  for (const route of data ?? []) {
    totalRatings += route.rating_count ?? 0;
    totalComments += route.comment_count ?? 0;
  }

  return { totalRoutes, totalRatings, totalComments };
}

async function getTopRoutes(supabaseAdmin: SupabaseClient) {
  const { data } = await supabaseAdmin
    .from('routes')
    .select('id, name, rating_avg, rating_count, comment_count')
    .eq('status', 'published')
    .order('rating_count', { ascending: false })
    .limit(10);

  return data ?? [];
}

async function getTotalUsers(supabaseAdmin: SupabaseClient) {
  const { count } = await supabaseAdmin.from('users').select('*', { count: 'exact', head: true });

  return count ?? 0;
}

function StatCard({
  label,
  value,
  subtitle,
}: {
  label: string;
  value: string | number;
  subtitle?: string;
}) {
  return (
    <div className="p-6 border border-neutral-800 rounded-2xl bg-neutral-900">
      <p className="text-sm text-neutral-400">{label}</p>
      <p className="mt-1 text-3xl font-bold text-neutral-50">{value}</p>
      {subtitle && <p className="mt-1 text-xs text-neutral-500">{subtitle}</p>}
    </div>
  );
}

export default async function AnalyticsPage() {
  const supabaseAdmin = getSupabaseAdmin();
  if (!supabaseAdmin) {
    return (
      <div>
        <h1 className="text-2xl font-bold text-neutral-50">Analytics</h1>
        <p className="mt-2 text-neutral-400">
          Set <code className="text-neutral-300">SUPABASE_SERVICE_ROLE_KEY</code> (and Supabase URL)
          to load analytics. Builds without this key still succeed.
        </p>
      </div>
    );
  }

  const [signupsByDay, engagement, topRoutes, totalUsers] = await Promise.all([
    getSignupsByDay(supabaseAdmin),
    getRouteEngagement(supabaseAdmin),
    getTopRoutes(supabaseAdmin),
    getTotalUsers(supabaseAdmin),
  ]);

  const signupDays = Object.entries(signupsByDay);
  const maxSignups = Math.max(...signupDays.map(([, count]) => count), 1);

  return (
    <div>
      <h1 className="text-2xl font-bold text-neutral-50">Analytics</h1>
      <p className="mt-2 text-neutral-400">Funnel metrics and engagement overview</p>

      {/* KPI cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
        <StatCard label="Total Users" value={totalUsers.toLocaleString()} />
        <StatCard label="Published Routes" value={engagement.totalRoutes.toLocaleString()} />
        <StatCard label="Total Ratings" value={engagement.totalRatings.toLocaleString()} />
        <StatCard label="Total Comments" value={engagement.totalComments.toLocaleString()} />
      </div>

      {/* Signups over time */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-50">Signups — Last 30 Days</h2>
        {signupDays.length === 0 ? (
          <p className="mt-4 text-neutral-500">No signups in the last 30 days.</p>
        ) : (
          <div className="mt-4 space-y-2">
            {signupDays.map(([day, count]) => (
              <div key={day} className="flex items-center gap-3">
                <span className="w-24 text-xs text-neutral-400 tabular-nums shrink-0">{day}</span>
                <div className="flex-1 h-5 bg-neutral-800 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${(count / maxSignups) * 100}%`,
                      backgroundColor: palette.primary500,
                    }}
                  />
                </div>
                <span className="w-8 text-right text-xs text-neutral-300 tabular-nums">
                  {count}
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Top routes */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-50">Top Routes by Ratings</h2>
        {topRoutes.length === 0 ? (
          <p className="mt-4 text-neutral-500">No published routes yet.</p>
        ) : (
          <div className="mt-4 overflow-x-auto">
            <table className="w-full text-sm text-left">
              <thead>
                <tr className="border-b border-neutral-800">
                  <th className="py-2 pr-4 text-neutral-400 font-medium">Route</th>
                  <th className="py-2 px-4 text-neutral-400 font-medium text-right">Avg Rating</th>
                  <th className="py-2 px-4 text-neutral-400 font-medium text-right">Ratings</th>
                  <th className="py-2 pl-4 text-neutral-400 font-medium text-right">Comments</th>
                </tr>
              </thead>
              <tbody>
                {topRoutes.map((route) => (
                  <tr key={route.id} className="border-b border-neutral-800/50">
                    <td className="py-3 pr-4 text-neutral-50">{route.name ?? 'Unnamed route'}</td>
                    <td className="py-3 px-4 text-neutral-300 text-right tabular-nums">
                      {route.rating_avg != null ? route.rating_avg.toFixed(1) : '—'}
                    </td>
                    <td className="py-3 px-4 text-neutral-300 text-right tabular-nums">
                      {route.rating_count}
                    </td>
                    <td className="py-3 pl-4 text-neutral-300 text-right tabular-nums">
                      {route.comment_count}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Search activity placeholder */}
      <section className="mt-10">
        <h2 className="text-lg font-semibold text-neutral-50">Search Activity</h2>
        <div className="mt-4 p-6 border border-neutral-800 rounded-2xl bg-neutral-900 text-center">
          <p className="text-neutral-500">PostHog event data integration coming soon.</p>
          <p className="mt-1 text-xs text-neutral-600">
            Track search queries, filter usage, and discovery funnels via PostHog events.
          </p>
        </div>
      </section>
    </div>
  );
}
