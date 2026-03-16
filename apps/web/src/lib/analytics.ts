declare global {
  interface Window {
    gtag: (...args: unknown[]) => void;
  }
}

function sendEvent(eventName: string, params?: Record<string, string>) {
  if (typeof window !== 'undefined' && window.gtag) {
    window.gtag('event', eventName, params);
  }
}

export function trackAppStoreClick(platform: 'ios' | 'android') {
  sendEvent('app_store_click', { platform });
}

export function trackWaitlistSignup() {
  sendEvent('waitlist_signup');
}

export function trackBlogRead(slug: string) {
  sendEvent('blog_read', { article_slug: slug });
}
