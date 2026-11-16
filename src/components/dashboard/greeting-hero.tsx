'use client';

import Link from 'next/link';
import { MotionConfig, motion, type Variants } from 'framer-motion';
import { ArrowRight, Check, Moon, Sun, Sunrise } from 'lucide-react';
import { cn } from '@/lib/utils';

export type HeroIssue = { label: string; href: string; tone: 'danger' | 'warning' };

const EASE = [0.22, 1, 0.36, 1] as const;

const word: Variants = {
  hidden: { y: '110%', opacity: 0, filter: 'blur(6px)' },
  show: (i: number) => ({ y: '0%', opacity: 1, filter: 'blur(0px)', transition: { duration: 0.7, ease: EASE, delay: 0.15 + i * 0.09 } }),
};

const TONE = {
  danger: { pill: 'border-red-200 bg-red-50 text-red-700 hover:border-red-300 hover:bg-red-100/70', dot: 'bg-red-500', ping: 'bg-red-400' },
  warning: { pill: 'border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100/70', dot: 'bg-amber-500', ping: 'bg-amber-400' },
};

/** Dashboard greeting: date, a big display-type greeting that rises in word by word, and the day's issues as live pills. */
export function GreetingHero({ date, greeting, issues, jobsToday }: { date: string; greeting: string; issues: HeroIssue[]; jobsToday: number }) {
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
            className={cn('flex size-6 items-center justify-center rounded-full', part === 'evening' ? 'bg-indigo-50 text-indigo-500' : 'bg-amber-50 text-amber-500')}
          >
            <Icon className="size-3.5" strokeWidth={2.4} />
          </motion.span>
          {date}
        </motion.p>

        <h1 className="font-display mt-2 text-[34px] leading-[1.05] font-bold tracking-[-0.035em] text-foreground sm:text-[44px]" aria-label={greeting}>
          {words.map((w, i) => (
            <span key={i} className="-mb-[0.2em] inline-block overflow-hidden pb-[0.2em] align-bottom" aria-hidden>
              <motion.span
                custom={i}
                variants={word}
                initial="hidden"
                animate="show"
                className={cn(
                  'inline-block',
                  w === part && '-mb-[0.2em] pb-[0.2em] bg-[linear-gradient(100deg,var(--brand-red)_0%,#f97316_45%,var(--brand-red)_90%)] bg-[length:220%_100%] bg-clip-text text-transparent motion-safe:animate-[hero-sheen_3.2s_ease-in-out_0.9s_1_both]'
                )}
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
                <Link href={it.href} className={cn('group inline-flex h-8 items-center gap-2 rounded-full border pr-2.5 pl-3 text-[13px] font-medium transition-colors', TONE[it.tone].pill)}>
                  <span className="relative flex size-2">
                    <span className={cn('absolute inline-flex size-full animate-ping rounded-full opacity-60', TONE[it.tone].ping)} />
                    <span className={cn('relative inline-flex size-2 rounded-full', TONE[it.tone].dot)} />
                  </span>
                  {it.label}
                  <ArrowRight className="size-3.5 opacity-50 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100" />
                </Link>
              </motion.div>
            ))
          ) : (
            <motion.span
              initial={{ opacity: 0, y: 8, scale: 0.92 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ type: 'spring', stiffness: 380, damping: 24, delay: after }}
              className="inline-flex h-8 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 pr-3 pl-2 text-[13px] font-medium text-emerald-700"
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
