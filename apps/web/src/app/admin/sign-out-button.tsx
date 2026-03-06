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
      style={{
        background: 'none',
        border: 'none',
        color: '#e74c3c',
        cursor: 'pointer',
        padding: 0,
        fontSize: 14,
      }}
    >
      Sign Out
    </button>
  );
}
