'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';

type Status = 'idle' | 'loading' | 'success' | 'error';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'https://motowise.onrender.com/graphql';

export function WaitlistForm() {
  const [email, setEmail] = useState('');
  const [status, setStatus] = useState<Status>('idle');
  const t = useTranslations('Cta');

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
      if (json.errors) throw new Error(json.errors?.[0]?.message ?? 'Unknown error');

      setStatus('success');
      setEmail('');
    } catch {
      setStatus('error');
    }
  }

  if (status === 'success') {
    return (
      <div className="success-enter flex flex-col items-center gap-3 rounded-lg border border-accent-500/30 bg-accent-500/10 px-6 py-5">
        <div className="flex items-center gap-3">
          <svg
            width="20"
            height="20"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="check-animate shrink-0 text-accent-400"
            aria-hidden="true"
          >
            <polyline points="20 6 9 17 4 12" />
          </svg>
          <p className="text-sm font-medium text-accent-300">
            {t('successMessage')}
          </p>
        </div>
        <p className="text-xs text-neutral-500 italic">
          {t('successTagline')}
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="relative flex w-full max-w-md flex-col gap-3 sm:flex-row">
      <input
        type="email"
        required
        value={email}
        onChange={(e) => {
          setEmail(e.target.value);
          if (status === 'error') setStatus('idle');
        }}
        placeholder={t('emailPlaceholder')}
        className="flex-1 rounded-lg border border-neutral-700 bg-neutral-900/80 px-4 py-3 text-sm text-neutral-100 placeholder-neutral-500 outline-none transition-colors focus-visible:border-warm-400 focus-visible:ring-2 focus-visible:ring-warm-400/50"
      />
      <button
        type="submit"
        disabled={status === 'loading'}
        className={`cta-primary shrink-0 rounded-lg bg-warm-500 px-6 py-3 text-sm font-semibold text-neutral-950 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-warm-400 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-950 ${status === 'loading' ? 'btn-shimmer' : ''}`}
      >
        {status === 'loading' ? t('submitting') : t('submitButton')}
      </button>
      {status === 'error' && (
        <p className="text-xs text-danger-500 sm:absolute sm:bottom-[-20px]">
          {t('errorMessage')}
        </p>
      )}
    </form>
  );
}
