'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { resetUser } from '@/lib/analytics';
import { getSupabaseBrowserClient } from '@/lib/supabase-browser';

export function SignOutButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleSignOut = async () => {
    setLoading(true);
    const supabase = getSupabaseBrowserClient();
    await supabase.auth.signOut();
    resetUser();
    router.push('/');
  };

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={loading}
      className="bg-transparent border-none text-danger-400 cursor-pointer p-0 text-sm hover:text-danger-300 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? 'Signing out...' : 'Sign Out'}
    </button>
  );
}
