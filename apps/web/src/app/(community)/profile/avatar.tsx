'use client';

import { useState } from 'react';

/**
 * A rider's avatar from Supabase storage, with the way out when the object is
 * gone: a broken image never shows inside the circle; the initial takes its
 * place, as it does for riders who never set a photo.
 */
export function Avatar({
  src,
  alt,
  initial,
  className,
}: {
  src: string | null | undefined;
  alt: string;
  /** Drawn when there is no photo or the photo fails to load. */
  initial: string;
  className: string;
}) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className={`${className} ${className}--initial`} aria-hidden="true">
        {initial}
      </span>
    );
  }
  return (
    // biome-ignore lint/performance/noImgElement: user avatar from Supabase storage, no known dimensions
    <img src={src} alt={alt} className={className} onError={() => setFailed(true)} />
  );
}
