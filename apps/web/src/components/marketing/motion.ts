'use client';

/**
 * Shared GSAP setup for marketing components.
 *
 * Motion vocabulary (keep every section speaking the same language):
 * - Entrances: masked rise (CSS `mv-rise` / `hero-char-rise`), GSAP `expo.out`
 * - Scroll:    scrubbed parallax / ScrollTrigger activation
 * - Ambient:   slow sine drift (haze, breath)
 * - Interaction: magnetic pull on fine pointers
 */
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

/** Magnetic pull toward the cursor. Call inside a `(pointer: fine)` context.
 *  Returns a cleanup function. */
export function makeMagnetic(el: HTMLElement, strengthX = 0.25, strengthY = 0.35): () => void {
  const xTo = gsap.quickTo(el, 'x', { duration: 0.4, ease: 'power3.out' });
  const yTo = gsap.quickTo(el, 'y', { duration: 0.4, ease: 'power3.out' });
  const onMove = (e: PointerEvent) => {
    const rect = el.getBoundingClientRect();
    xTo((e.clientX - rect.left - rect.width / 2) * strengthX);
    yTo((e.clientY - rect.top - rect.height / 2) * strengthY);
  };
  const onLeave = () => {
    xTo(0);
    yTo(0);
  };
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerleave', onLeave);
  return () => {
    el.removeEventListener('pointermove', onMove);
    el.removeEventListener('pointerleave', onLeave);
  };
}
