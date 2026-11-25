'use client';

import { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';

export interface DonutSlice {
  label: string;
  value: number;
  color: string;
}

const R = 64;
const CIRC = 2 * Math.PI * R;

/** Animated donut chart of fleet composition; the arc lengths sweep in with GSAP. */
export function FleetDonut({ slices, total }: { slices: DonutSlice[]; total: number }) {
  const [progress, setProgress] = useState(0);
  const obj = useRef({ v: 0 });

  useEffect(() => {
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const tween = gsap.to(obj.current, {
      v: 1,
      duration: reduce ? 0 : 1.1,
      ease: 'power2.out',
      delay: reduce ? 0 : 0.25,
      onUpdate: () => setProgress(obj.current.v),
    });
    return () => {
      tween.kill();
    };
  }, []);

  const filled = slices.filter((s) => s.value > 0);
  const starts = filled.map((_, i) => filled.slice(0, i).reduce((acc, x) => acc + (total > 0 ? x.value / total : 0), 0));
  const arcs = filled.map((s, i) => {
    const frac = total > 0 ? s.value / total : 0;
    const len = frac * CIRC * progress;
    // Segments sit in their final positions; only their lengths sweep in
    return { ...s, dasharray: `${len} ${CIRC - len}`, dashoffset: -starts[i] * CIRC };
  });

  return (
    <div className="relative size-40 shrink-0">
      <svg viewBox="0 0 160 160" className="size-full -rotate-90">
        <circle cx="80" cy="80" r={R} fill="none" stroke="var(--warm-gray-100)" strokeWidth="18" />
        {arcs.map((a) => (
          <circle
            key={a.label}
            cx="80"
            cy="80"
            r={R}
            fill="none"
            stroke={a.color}
            strokeWidth="18"
            strokeDasharray={a.dasharray}
            strokeDashoffset={a.dashoffset}
            strokeLinecap="butt"
          />
        ))}
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tabular text-3xl font-bold tracking-tight text-foreground">{Math.round(total * progress)}</span>
        <span className="text-[11px] font-medium text-muted-foreground">units</span>
      </div>
    </div>
  );
}
