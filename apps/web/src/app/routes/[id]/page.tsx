import { redirect } from 'next/navigation';

/**
 * 301 redirect: /routes/:id -> /trips/:id
 *
 * Old route-by-ID URLs are permanently redirected to the unified /trips/ path.
 * Original implementation preserved in git history.
 */
export default async function RouteDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  redirect(`/trips/${id}`);
}
