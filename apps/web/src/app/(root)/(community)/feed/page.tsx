import { redirect } from 'next/navigation';

/** Redirect old /feed bookmarks to the new /garage dashboard */
export default function FeedRedirect() {
  redirect('/garage');
}
