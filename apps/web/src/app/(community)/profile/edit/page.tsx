'use client';

import type { MeQuery } from '@motovault/graphql';
import { MeDocument, UpdateMyProfileDocument } from '@motovault/graphql';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import posthog from 'posthog-js';
import { useEffect, useState } from 'react';
import { gqlFetcher } from '@/lib/graphql-client';

const USERNAME_REGEX = /^[a-z0-9_]{3,30}$/;

export default function EditProfilePage() {
  const router = useRouter();
  const queryClient = useQueryClient();

  const { data: meData, isLoading } = useQuery({
    queryKey: ['me'],
    queryFn: () => gqlFetcher(MeDocument),
  });

  const user: MeQuery['me'] | undefined = meData?.me;

  const [username, setUsername] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [bio, setBio] = useState('');
  const [city, setCity] = useState('');
  const [isPublic, setIsPublic] = useState(false);
  const [error, setError] = useState('');
  const [initialized, setInitialized] = useState(false);

  // Initialize form with existing data
  useEffect(() => {
    if (user && !initialized) {
      setUsername(user.publicUsername ?? '');
      setDisplayName(user.displayName ?? user.fullName ?? '');
      setBio(user.bio ?? '');
      setCity(user.city ?? '');
      setIsPublic(user.isPublic ?? false);
      setInitialized(true);
    }
  }, [user, initialized]);

  const updateMutation = useMutation({
    mutationFn: () =>
      gqlFetcher(UpdateMyProfileDocument, {
        input: {
          publicUsername: username.toLowerCase().trim(),
          displayName: displayName.trim(),
          bio: bio.trim() || undefined,
          city: city.trim() || undefined,
          isPublic,
        },
      }),
    onSuccess: () => {
      posthog.capture('profile_updated', {
        is_public: isPublic,
        has_bio: bio.trim().length > 0,
        has_city: city.trim().length > 0,
      });
      queryClient.invalidateQueries({ queryKey: ['me'] });
      router.push('/profile');
    },
    onError: (err: Error) => {
      setError(err.message ?? 'Failed to update profile');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    const trimmedUsername = username.toLowerCase().trim();
    if (!trimmedUsername) {
      setError('Username is required');
      return;
    }
    if (!USERNAME_REGEX.test(trimmedUsername)) {
      setError(
        'Username must be 3-30 characters, lowercase letters, numbers, and underscores only',
      );
      return;
    }
    if (!displayName.trim()) {
      setError('Display name is required');
      return;
    }

    updateMutation.mutate();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-neutral-700 border-t-warm-400" />
      </div>
    );
  }

  const isNewProfile = !user?.publicUsername;

  return (
    <div className="mx-auto max-w-lg">
      <h1 className="text-xl font-bold text-neutral-50">
        {isNewProfile ? 'Set Up Your Public Profile' : 'Edit Profile'}
      </h1>
      {isNewProfile && (
        <p className="mt-1 text-sm text-neutral-500">
          Create a public profile so other riders can find and follow you.
        </p>
      )}

      {error && (
        <p role="alert" className="mt-4 text-sm text-danger-500">
          {error}
        </p>
      )}

      <form onSubmit={handleSubmit} className="mt-6 space-y-5">
        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-username" className="text-sm font-medium text-neutral-400">
            Username
          </label>
          <div className="flex items-center rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3">
            <span className="text-neutral-600">@</span>
            <input
              id="edit-username"
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ''))}
              maxLength={30}
              required
              placeholder="your_username"
              className="ml-1 flex-1 bg-transparent text-neutral-50 placeholder:text-neutral-600 focus:outline-none"
            />
          </div>
          <p className="text-xs text-neutral-600">
            3-30 characters, lowercase, numbers, underscores
          </p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-displayname" className="text-sm font-medium text-neutral-400">
            Display Name
          </label>
          <input
            id="edit-displayname"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            maxLength={50}
            required
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
          />
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-bio" className="text-sm font-medium text-neutral-400">
            Bio
          </label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            maxLength={300}
            rows={3}
            placeholder="Tell other riders about yourself..."
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent resize-none"
          />
          <p className="text-right text-xs text-neutral-600">{bio.length}/300</p>
        </div>

        <div className="flex flex-col gap-1.5">
          <label htmlFor="edit-city" className="text-sm font-medium text-neutral-400">
            City
          </label>
          <input
            id="edit-city"
            type="text"
            value={city}
            onChange={(e) => setCity(e.target.value)}
            maxLength={100}
            placeholder="e.g. Prague, Czechia"
            className="rounded-xl border border-neutral-700 bg-neutral-900 px-4 py-3 text-neutral-50 placeholder:text-neutral-600 focus:outline-none focus:ring-2 focus:ring-warm-500 focus:border-transparent"
          />
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setIsPublic(!isPublic)}
            role="switch"
            aria-checked={isPublic}
            className={`relative h-6 w-11 rounded-full transition-colors ${
              isPublic ? 'bg-warm-500' : 'bg-neutral-700'
            }`}
          >
            <span
              className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white transition-transform ${
                isPublic ? 'translate-x-5' : ''
              }`}
            />
          </button>
          <span className="text-sm text-neutral-300">Public profile</span>
        </div>

        <div className="flex gap-3 pt-2">
          <button
            type="submit"
            disabled={updateMutation.isPending}
            className="flex-1 rounded-full bg-warm-500 px-6 py-3 font-semibold text-neutral-950 transition-colors hover:bg-warm-400 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {updateMutation.isPending ? 'Saving...' : 'Save Profile'}
          </button>
          {!isNewProfile && (
            <button
              type="button"
              onClick={() => router.back()}
              className="rounded-full border border-neutral-700 px-6 py-3 font-semibold text-neutral-300 transition-colors hover:bg-neutral-800"
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
