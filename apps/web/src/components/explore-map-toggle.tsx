'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useCallback } from 'react';

export function ExploreMapToggle() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const isMap = searchParams.get('view') === 'map';

  const toggle = useCallback(() => {
    const params = new URLSearchParams(searchParams.toString());
    if (isMap) {
      params.delete('view');
    } else {
      params.set('view', 'map');
    }
    router.push(`/explore?${params.toString()}`, { scroll: false });
  }, [isMap, searchParams, router]);

  return (
    <button
      type="button"
      onClick={toggle}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 8,
        padding: '10px 16px',
        borderRadius: 999,
        border: '1px solid var(--mv-line)',
        background: isMap ? 'var(--mv-warm-500)' : 'var(--mv-surface)',
        color: isMap ? '#000' : 'var(--mv-ink-2)',
        fontSize: 11,
        fontFamily: 'var(--font-geist-mono, monospace)',
        letterSpacing: '0.1em',
        textTransform: 'uppercase',
        cursor: 'pointer',
        transition: 'all 0.2s',
        whiteSpace: 'nowrap',
      }}
    >
      {isMap ? (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <title>Grid</title>
          <rect x="3" y="3" width="7" height="7" />
          <rect x="14" y="3" width="7" height="7" />
          <rect x="3" y="14" width="7" height="7" />
          <rect x="14" y="14" width="7" height="7" />
        </svg>
      ) : (
        <svg
          width="14"
          height="14"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <title>Map</title>
          <path d="M9 6.75V15m6-6v8.25m.503 3.498l4.875-2.437c.381-.19.622-.58.622-1.006V4.82c0-.836-.88-1.38-1.628-1.006l-3.869 1.934c-.317.159-.69.159-1.006 0L9.503 3.252a1.125 1.125 0 00-1.006 0L3.622 5.689C3.24 5.88 3 6.27 3 6.695V19.18c0 .836.88 1.38 1.628 1.006l3.869-1.934c.317-.159.69-.159 1.006 0l4.994 2.497c.317.158.69.158 1.006 0z" />
        </svg>
      )}
      {isMap ? 'Grid view' : 'Map view'}
    </button>
  );
}
