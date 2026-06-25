import { BlogPostStatus } from '@motovault/types';

/** Shared TanStack key so editor mutations invalidate the admin list (plan U9). */
export const ADMIN_BLOG_LIST_KEY = ['admin', 'blog-posts'] as const;

const BADGE_CLASS: Record<string, string> = {
  [BlogPostStatus.DRAFT]: 'bg-neutral-800 text-neutral-300',
  [BlogPostStatus.SCHEDULED]: 'bg-amber-900/50 text-amber-300',
  [BlogPostStatus.PUBLISHED]: 'bg-emerald-900/50 text-emerald-300',
};

export function StatusBadge({
  status,
  scheduledFor,
}: {
  status: string;
  scheduledFor?: string | null;
}) {
  const cls = BADGE_CLASS[status] ?? 'bg-neutral-800 text-neutral-400';
  const label =
    status === BlogPostStatus.SCHEDULED && scheduledFor
      ? `scheduled · ${new Date(scheduledFor).toLocaleString()}`
      : status;
  return <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
}
