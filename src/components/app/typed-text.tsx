'use client';

import { useEffect, useState } from 'react';

const SEP = '';

/**
 * Typewriter effect in the spirit of typed.js/react-typed, dependency-free:
 * types each string in, holds, deletes, moves to the next, looping forever.
 * With prefers-reduced-motion the first string is shown statically.
 */
export function TypedText({ strings, className }: { strings: string[]; className?: string }) {
  const [text, setText] = useState('');

  // Stable effect dep: restart only when the strings themselves change
  const joined = strings.join(SEP);
  useEffect(() => {
    const list = joined.split(SEP);
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const id = requestAnimationFrame(() => setText(list[0]));
      return () => cancelAnimationFrame(id);
    }
    let strIndex = 0;
    let charIndex = 0;
    let deleting = false;
    let cancelled = false;
    let timeout: ReturnType<typeof setTimeout>;

    const tick = () => {
      if (cancelled) return;
      const current = list[strIndex];
      if (!deleting) {
        charIndex++;
        setText(current.slice(0, charIndex));
        if (charIndex === current.length) {
          deleting = true;
          timeout = setTimeout(tick, 2400); // hold the finished string
        } else {
          timeout = setTimeout(tick, 20 + Math.random() * 18);
        }
      } else {
        charIndex--;
        setText(current.slice(0, charIndex));
        if (charIndex === 0) {
          deleting = false;
          strIndex = (strIndex + 1) % list.length;
          timeout = setTimeout(tick, 500);
        } else {
          timeout = setTimeout(tick, 12);
        }
      }
    };
    timeout = setTimeout(tick, 500); // let the greeting rise in first
    return () => {
      cancelled = true;
      clearTimeout(timeout);
    };
  }, [joined]);

  return (
    <span className={className} aria-label={strings[0]}>
      <span aria-hidden>{text}</span>
      <span aria-hidden className="ml-0.5 inline-block w-[0.45em] animate-pulse border-b-2
        border-current align-baseline" style={{ height: '0.9em' }} />
    </span>
  );
}
