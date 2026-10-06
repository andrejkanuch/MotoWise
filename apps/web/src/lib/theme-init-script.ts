/**
 * The root layout's inline pre-paint script: adds the `dark` class before
 * first paint so the dark theme never flashes light (FOUC).
 *
 * It is a raw `<script dangerouslySetInnerHTML>`, so Next.js does NOT stamp
 * the request nonce on it. On the strict-nonce-CSP routes (/garage, /profile,
 * /welcome, /feed, /admin; see proxy.ts) the browser therefore blocked it
 * ("Executing inline script violates the following Content Security Policy
 * directive") on every load. The CSP allows it by hash instead: a hash pins
 * exactly this text, so it does not widen the policy the way 'unsafe-inline'
 * would. Change the script and the hash together (a unit test enforces it).
 */
export const THEME_INIT_SCRIPT = "document.documentElement.classList.add('dark')";

/** CSP source for {@link THEME_INIT_SCRIPT}: `'sha256-<base64 of its UTF-8 digest>'`. */
export const THEME_INIT_SCRIPT_CSP_HASH = "'sha256-8/JOXyWhT/LhKZY9U5Cdee8G1O48pXy/45IaKPBUq6s='";
