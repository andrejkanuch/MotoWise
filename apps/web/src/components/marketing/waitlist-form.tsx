'use client';

import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://motowise.onrender.com/graphql';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;

    setStatus('loading');

    try {
      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: `mutation JoinWaitlist($email: String!) { joinWaitlist(email: $email) }`,
          variables: { email: email.trim() },
        }),
      });

      const json = await res.json();
      if (json.errors) throw new Error(json.errors[0].message);

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="flex items-center gap-3 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-6 py-4">
        <svg
          width="20"
          height="20"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-emerald-400"
          aria-hidden="true"
        >
          <polyline points="20 6 9 17 4 12" />
        </svg>
        <p className="text-sm font-medium text-emerald-300">
          You&apos;re in! We&apos;ll notify you when MotoVault launches.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === 'error') setStatus('idle');
        }}
        placeholder="your@email.com"
        className="flex-1 rounded-xl border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus:border-warm-400 focus:ring-1 focus:ring-warm-400/50"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className="cta-primary shrink-0 rounded-xl bg-warm-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-opacity disabled:opacity-50"
      >
        {status === 'loading' ? 'Joining...' : 'Notify Me'}
      </button>
      {status === 'error' && (
        <p className="text-xs text-red-400 sm:absolute sm:bottom-[-20px]">
          Something went wrong. Please try again.
        </p>
      )}
    </form>
  );
}
