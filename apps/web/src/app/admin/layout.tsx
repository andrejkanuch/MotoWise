import type { Metadata } from 'next';
import { AdminNav } from './admin-nav';

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
