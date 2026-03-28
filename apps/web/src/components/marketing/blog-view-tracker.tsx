'use client';

import { useEffect } from 'react';
import { trackEvent } from '@/lib/meta-pixel';

export function BlogViewTracker({ title, category }: { title: string; category?: string }) {
  useEffect(() => {
    trackEvent('ViewContent', {
      content_name: title,
      content_category: category || 'blog',
    });
  }, [title, category]);

  return null;
}
