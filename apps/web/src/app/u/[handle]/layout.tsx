import Link from 'next/link';
import { notFound } from 'next/navigation';
import { fetchProfile } from '../../../lib/fetch-profile';

export default async function UserProfileLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ handle: string }>;
}) {
  const { handle } = await params;
  const profile = await fetchProfile(handle);

  if (!profile) {
    notFound();
  }

  const displayName = profile.displayName ?? profile.publicUsername;
  const initial = displayName.charAt(0).toUpperCase();

  return (
    <div className="min-h-screen bg-neutral-50">
      {/* User header */}
      <header className="bg-gradient-to-br from-neutral-950 to-neutral-800 text-white">
        <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
          <div className="flex items-center gap-4">
            {profile.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="h-16 w-16 rounded-full border-2 border-white/20 object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-white/10 text-2xl font-bold text-white/80">
                {initial}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold">{displayName}</h1>
              <p className="text-sm text-white/60">@{profile.publicUsername}</p>
            </div>
          </div>

          {/* Tabs */}
          <nav className="mt-6 flex gap-1">
            <Link
              href={`/u/${profile.publicUsername}/saved`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Saved Routes
            </Link>
            <Link
              href={`/rider/${profile.publicUsername}`}
              className="rounded-lg px-4 py-2 text-sm font-medium text-white/80 transition-colors hover:bg-white/10 hover:text-white"
            >
              Profile
            </Link>
          </nav>
        </div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">{children}</main>

      {/* CTA footer */}
      <footer className="border-t border-neutral-200 bg-white py-10">
        <div className="mx-auto max-w-3xl px-4 text-center sm:px-6">
          <p className="text-lg font-bold text-neutral-900">
            Discover motorcycle routes with MotoVault
          </p>
          <p className="mt-1 text-sm text-neutral-500">
            Save routes, track rides, maintain your bike — all in one app
          </p>
          <div className="mt-6 flex items-center justify-center gap-3">
            <a
              href="https://apps.apple.com/app/motovault/id6745417382"
              className="inline-flex items-center rounded-xl bg-neutral-900 px-6 py-3 text-sm font-semibold text-white transition-colors hover:bg-neutral-800"
            >
              Download on iOS
            </a>
            <a
              href="https://play.google.com/store/apps/details?id=com.motovault.app"
              className="inline-flex items-center rounded-xl border border-neutral-300 bg-white px-6 py-3 text-sm font-semibold text-neutral-900 transition-colors hover:bg-neutral-50"
            >
              Get on Android
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}
