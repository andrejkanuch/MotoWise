/**
 * The root layout's inline pre-paint script: resolves the colour scheme
 * before first paint so neither scheme flashes. The stored choice
 * (localStorage `mv-theme`: 'light' | 'dark') wins; otherwise the OS
 * preference decides; if storage is unavailable, dark is the default.
 * The ThemeProvider (src/providers/theme-provider.tsx) owns the same key
 * and keeps the class in sync after hydration.
 *
 * It is a raw `<script dangerouslySetInnerHTML>`, so Next.js does NOT stamp
 * the request nonce on it. On the strict-nonce-CSP routes (/garage, /profile,
 * /welcome, /feed, /admin; see proxy.ts) the browser would block it. The CSP
 * allows it by hash instead: a hash pins exactly this text, so it does not
 * widen the policy the way 'unsafe-inline' would. Change the script and the
 * hash together (a unit test enforces it).
 */
export const THEME_STORAGE_KEY = 'mv-theme';

export const THEME_INIT_SCRIPT =
  "(function(){var d=true;try{var s=localStorage.getItem('mv-theme');d=s==='dark'||(s!=='light'&&matchMedia('(prefers-color-scheme: dark)').matches)}catch(e){}document.documentElement.classList.toggle('dark',d)})()";

/** CSP source for {@link THEME_INIT_SCRIPT}: `'sha256-<base64 of its UTF-8 digest>'`. */
export const THEME_INIT_SCRIPT_CSP_HASH = "'sha256-t05KKNY5FyAEmoevqWMBPJQb+bw/i6BwXe0ohYYKFKY='";
