import { PublicNavbar } from '@/components/public-navbar';

export default function ProLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-50">
      <PublicNavbar />
      {children}
    </div>
  );
}
