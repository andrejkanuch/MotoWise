'use client';

import Image from 'next/image';
import { useState } from 'react';

interface ShowcaseImageProps {
  src: string;
  alt: string;
  width: number;
  height: number;
  sizes: string;
}

/**
 * Image with graceful error fallback for marketing phone mockups.
 * Shows a neutral placeholder instead of a broken-image icon.
 */
export function ShowcaseImage({ src, alt, width, height, sizes }: ShowcaseImageProps) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return (
      <div
        className="flex w-full items-center justify-center bg-neutral-900 text-neutral-600"
        style={{ aspectRatio: `${width}/${height}` }}
        role="img"
        aria-label={alt}
      >
        <svg
          width="32"
          height="32"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <path d="m21 15-5-5L5 21" />
        </svg>
      </div>
    );
  }

  return (
    <Image
      src={src}
      alt={alt}
      width={width}
      height={height}
      className="block w-full transition-transform duration-500 group-hover:scale-[1.02]"
      sizes={sizes}
      loading="lazy"
      onError={() => setFailed(true)}
    />
  );
}
