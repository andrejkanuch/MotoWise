import { redirect } from 'next/navigation';
import { CommunityNav } from '@/components/community-nav';
import { getSupabaseServerClient } from '@/lib/supabase-server';

export default async function CommunityLayout({ children }: { children: React.ReactNode }) {
  const supabase = await getSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  // Read display name from user metadata for the nav bar
  const displayName =
    user.user_metadata?.display_name ?? user.user_metadata?.full_name ?? user.email;

  return (
    <div className="min-h-screen bg-neutral-950">
      <CommunityNav displayName={displayName} />
      <main className="mx-auto max-w-4xl px-4 py-6">{children}</main>
    </div>
  );
}
