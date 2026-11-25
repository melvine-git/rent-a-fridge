'use client';

import { useEffect, useRef } from 'react';
import gsap from 'gsap';

/**
 * GSAP entrance animations for the dashboard: sections marked with
 * `data-motion` fade/rise in with a gentle stagger on first load.
 * Respects prefers-reduced-motion; cleans up on unmount.
 */
export function DashboardMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const ctx = gsap.context(() => {
      gsap.utils.toArray<HTMLElement>('[data-motion]').forEach((el, i) => {
        gsap.fromTo(
          el,
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: 0.6, ease: 'power2.out', delay: 0.05 + i * 0.08, clearProps: 'opacity,transform' }
        );
      });
      gsap.utils.toArray<HTMLElement>('[data-motion-img]').forEach((el) => {
        gsap.fromTo(el, { opacity: 0, scale: 1.04 }, { opacity: 1, scale: 1, duration: 1.1, ease: 'power2.out', clearProps: 'opacity,transform' });
      });
    }, ref);
    return () => ctx.revert();
  }, []);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
