'use client';

import { useCallback, useEffect, useRef } from 'react';

/**
 * Warm-toned cursor dot that trails the mouse pointer.
 * Expands into a hollow ring when hovering links / buttons.
 * Hidden on touch-only devices via CSS `@media (hover: none)`.
 */
export function CursorDot() {
  const ref = useRef<HTMLDivElement>(null);
  const pos = useRef({ cx: 0, cy: 0, tx: 0, ty: 0 });
  const raf = useRef(0);

  const loop = useCallback(() => {
    const p = pos.current;
    p.cx += (p.tx - p.cx) * 0.2;
    p.cy += (p.ty - p.cy) * 0.2;
    const el = ref.current;
    if (el) {
      el.style.left = `${p.cx}px`;
      el.style.top = `${p.cy}px`;
    }
    raf.current = requestAnimationFrame(loop);
  }, []);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const onMove = (e: MouseEvent) => {
      pos.current.tx = e.clientX;
      pos.current.ty = e.clientY;
      el.style.opacity = '1';
    };

    const onEnter = () => el.classList.add('mv-cursor-hover');
    const onLeave = () => el.classList.remove('mv-cursor-hover');

    window.addEventListener('mousemove', onMove, { passive: true });
    raf.current = requestAnimationFrame(loop);

    // Observe DOM for dynamically-added links/buttons
    const bindTargets = () => {
      document.querySelectorAll('a, button, [data-cursor]').forEach((target) => {
        target.addEventListener('mouseenter', onEnter);
        target.addEventListener('mouseleave', onLeave);
      });
    };
    bindTargets();

    const observer = new MutationObserver(bindTargets);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.removeEventListener('mousemove', onMove);
      cancelAnimationFrame(raf.current);
      observer.disconnect();
      document.querySelectorAll('a, button, [data-cursor]').forEach((target) => {
        target.removeEventListener('mouseenter', onEnter);
        target.removeEventListener('mouseleave', onLeave);
      });
    };
  }, [loop]);

  return <div ref={ref} className="mv-cursor-dot" />;
}
