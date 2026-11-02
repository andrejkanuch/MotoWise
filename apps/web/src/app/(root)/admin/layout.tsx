import type { Metadata } from 'next';
import { AdminNav } from './admin-nav';

// Admin pages read live data behind the auth check, so they must never be
// prerendered at build: the root layout no longer forces every route dynamic.
export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Admin',
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex flex-col md:flex-row min-h-screen bg-neutral-950">
      <AdminNav />
      <main className="flex-1 p-6">{children}</main>
    </div>
  );
}
