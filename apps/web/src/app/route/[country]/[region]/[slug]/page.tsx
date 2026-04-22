import { redirect } from 'next/navigation';

/**
 * 301 redirect: /route/:country/:region/:slug -> /trips/:country/:region/:slug
 *
 * Old route URLs are permanently redirected to the unified /trips/ path.
 * Original implementation preserved in git history.
 */
export default async function RouteDetailPage({
  params,
}: {
  params: Promise<{ country: string; region: string; slug: string }>;
}) {
  const { slug, country, region } = await params;
  redirect(`/trips/${country}/${region}/${slug}`);
}
