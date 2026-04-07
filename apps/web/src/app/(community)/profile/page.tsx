'use client';

import type { MeQuery, MyMotorcyclesQuery } from '@motovault/graphql';
import { MeDocument, MyMotorcyclesDocument } from '@motovault/graphql';
import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { useEffect } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';

type User = MeQuery['me'];
type Motorcycle = MyMotorcyclesQuery['myMotorcycles'][number];

export default function ProfilePage() {
  const router = useRouter();

  const { data: meData, isLoading: meLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => gqlFetcher(MeDocument),
  });

  const { data: bikesData } = useQuery({
    queryKey: ['myMotorcycles'],
    queryFn: () => gqlFetcher(MyMotorcyclesDocument),
  });

  const user: User | undefined = meData?.me;
  const bikes: Motorcycle[] = bikesData?.myMotorcycles ?? [];

  // If no public profile set up, redirect to edit
  useEffect(() => {
    if (!meLoading && user && !user.publicUsername) {
      router.replace('/profile/edit');
    }
  }, [meLoading, user, router]);

  if (meLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-warm-400" />
      </div>
    );
  }

  if (!user || !user.publicUsername) {
    return null; // Will redirect
  }

  const initial = user.displayName?.charAt(0)?.toUpperCase() ?? user.email.charAt(0).toUpperCase();

  return (
    <div className="space-y-8">
      {/* Profile header */}
      <div className="rounded-2xl border border-neutral-800 bg-neutral-900/50 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user.avatarUrl ? (
              // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage
              <img
                src={user.avatarUrl}
                alt={user.displayName ?? 'Avatar'}
                className="h-16 w-16 rounded-full object-cover"
              />
            ) : (
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-neutral-800 text-2xl font-bold text-neutral-300">
                {initial}
              </div>
            )}
            <div>
              <h1 className="text-xl font-bold text-neutral-50">
                {user.displayName ?? user.fullName ?? 'Rider'}
              </h1>
              <p className="text-sm text-neutral-500">@{user.publicUsername}</p>
              {user.city && <p className="mt-0.5 text-sm text-neutral-500">{user.city}</p>}
            </div>
          </div>
          <a
            href="/profile/edit"
            className="rounded-lg bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-300 transition-colors hover:bg-neutral-700"
          >
            Edit Profile
          </a>
        </div>

        {user.bio && <p className="mt-4 text-sm leading-relaxed text-neutral-400">{user.bio}</p>}

        {/* Stats */}
        <div className="mt-6 flex gap-6">
          <a href="/profile/followers" className="group text-center">
            <p className="text-lg font-bold text-neutral-100">{user.followerCount ?? 0}</p>
            <p className="text-xs text-neutral-500 group-hover:text-neutral-400">Followers</p>
          </a>
          <a href="/profile/followers" className="group text-center">
            <p className="text-lg font-bold text-neutral-100">{user.followingCount ?? 0}</p>
            <p className="text-xs text-neutral-500 group-hover:text-neutral-400">Following</p>
          </a>
        </div>
      </div>

      {/* Bikes */}
      {bikes.length > 0 && (
        <section>
          <h2 className="mb-3 text-lg font-bold text-neutral-100">Garage</h2>
          <div className="space-y-3">
            {bikes.map((bike) => (
              <div
                key={bike.id}
                className="rounded-xl border border-neutral-800 bg-neutral-900/50 p-4"
              >
                <p className="font-semibold text-neutral-100">
                  {bike.nickname ?? `${bike.year} ${bike.make} ${bike.model}`}
                </p>
                {bike.nickname && (
                  <p className="text-sm text-neutral-500">
                    {bike.year} {bike.make} {bike.model}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <p className="text-xs text-neutral-600">
        Member since{' '}
        {new Date(user.createdAt).toLocaleDateString('en-US', { year: 'numeric', month: 'long' })}
      </p>
    </div>
  );
}
