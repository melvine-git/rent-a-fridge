'use client';

import Link from 'next/link';
import { MotionConfig, motion, type Variants } from 'framer-motion';
import { ArrowRight, Check, Moon, Sun, Sunrise } from 'lucide-react';
import { cn } from '@/lib/utils';
import { TypedText } from '@/components/app/typed-text';

export type HeroIssue = { label: string; href: string; tone: 'danger' | 'warning' };

const EASE = [0.22, 1, 0.36, 1] as const;

const word: Variants = {
  hidden: { y: '110%', opacity: 0, filter: 'blur(6px)' },
  show: (i: number) => ({ y: '0%', opacity: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE, delay: 0.15 + i * 0.09 } }),
};

const PILL = 'border-stone-200 bg-white text-foreground shadow-[var(--shadow-xs)] hover:border-stone-300 hover:bg-stone-50';

/** Dashboard greeting: date, a big display-type greeting that rises in word by word, and the day's issues as live pills. */
export function GreetingHero({ date, day, greeting, issues, jobsToday }: { date: string; day: string; greeting: string; issues: HeroIssue[]; jobsToday: number }) {
  const words = greeting.split(' ');
  const part = greeting.endsWith('morning') ? 'morning' : greeting.endsWith('afternoon') ? 'afternoon' : 'evening';
  const Icon = part === 'morning' ? Sunrise : part === 'afternoon' ? Sun : Moon;
  const after = 0.25 + words.length * 0.09;

  return (
    <MotionConfig reducedMotion="user">
      <div className="min-w-0">
        <motion.p
          initial={{ opacity: 0, x: -8 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5, ease: EASE }}
          className="flex items-center gap-2 text-xs font-semibold tracking-[0.16em] text-muted-foreground uppercase"
        >
          <motion.span
            initial={{ rotate: -90, scale: 0.4, opacity: 0 }}
            animate={{ rotate: 0, scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 260, damping: 16, delay: 0.1 }}
            className="flex size-6 items-center justify-center rounded-full bg-stone-100 text-stone-500"
          >
            <Icon className="size-3.5" strokeWidth={2.4} />
          </motion.span>
          <TypedText strings={[date, day]} />
        </motion.p>

        <h1 className="font-display mt-2 text-[34px] leading-[1.05] font-bold tracking-[-0.035em] text-foreground sm:text-[44px]" aria-label={greeting}>
          {words.map((w, i) => (
            <span key={i} className="-mb-[0.2em] inline-block overflow-hidden pb-[0.2em] align-bottom" aria-hidden>
              <motion.span
                custom={i}
                variants={word}
                initial="hidden"
                animate="show"
                className="inline-block"
              >
                {w}
              </motion.span>
              {i < words.length - 1 && '\u00a0'}
            </span>
          ))}
        </h1>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          {issues.length ? (
            issues.map((it, i) => (
              <motion.div
                key={it.label}
                initial={{ opacity: 0, y: 8, scale: 0.92 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ type: 'spring', stiffness: 380, damping: 24, delay: after + i * 0.08 }}
              >
                <Link href={it.href} className={cn('group inline-flex h-8 items-center gap-2 rounded-full border pr-2.5 pl-3 text-[13px] font-medium transition-colors', PILL)}>
                  {it.label}
                  <ArrowRight className="size-3.5 text-muted-foreground opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              </motion.div>
            ))
          ) : (
            <motion.span
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24, delay: after }}
              className={cn('inline-flex h-8 items-center gap-2 rounded-full border pr-3 pl-2 text-[13px] font-medium', PILL)}
            >
              <span className="flex size-5 items-center justify-center rounded-full bg-emerald-500 text-white">
                <Check className="size-3" strokeWidth={3} />
              </span>
              Everything is on track
            </motion.span>
          )}
          <motion.span initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: after + issues.length * 0.08 + 0.1, duration: 0.4 }} className="text-[13px] text-muted-foreground">
            {jobsToday ? `${jobsToday} ${jobsToday === 1 ? 'job' : 'jobs'} on today's run` : 'Nothing on the run today'}
          </motion.span>
        </div>
      </div>
    </MotionConfig>
  );
}
