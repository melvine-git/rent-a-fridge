'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import gsap from 'gsap';

/**
 * App-wide GSAP entrance animation: on every page navigation, the page's
 * top-level sections fade/rise in with a gentle stagger. Pages that choreograph
 * their own motion with `data-motion` markers (e.g. the dashboard) are left alone.
 * Respects prefers-reduced-motion; cleans up on unmount.
 */
export function PageMotion({ children }: { children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    const root = ref.current?.firstElementChild;
    if (!root || root.querySelector('[data-motion]')) return;
    const targets = Array.from(root.children);
    if (!targets.length) return;
    const ctx = gsap.context(() => {
      gsap.fromTo(targets, { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: 0.5, ease: 'power2.out', stagger: 0.07, clearProps: 'opacity,transform' });
    }, ref);
    return () => ctx.revert();
  }, [pathname]);

  return (
    <div ref={ref} className="contents">
      {children}
    </div>
  );
}
