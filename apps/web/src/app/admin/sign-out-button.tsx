'use client';

import { createBrowserClient } from '@supabase/ssr';
import { useRouter } from 'next/navigation';

export function SignOutButton() {
  const router = useRouter();

  const handleSignOut = async () => {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? '',
    );
    await supabase.auth.signOut();
    router.push('/');
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      className="bg-transparent border-none text-danger-500 cursor-pointer p-0 text-sm hover:text-danger-600 dark:text-danger-400 dark:hover:text-danger-300 transition-colors"
    >
      Sign Out
    </button>
  );
}
