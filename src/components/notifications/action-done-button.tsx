'use client';

import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Loader2, RotateCcw } from 'lucide-react';
import { setBookingActionDone } from '@/lib/actions';
import { cn } from '@/lib/utils';

/** Marks a booking's follow-up action done, or opens it again. */
export function ActionDoneButton({ bookingId, done = false, className }: { bookingId: string; done?: boolean; className?: string }) {
  const router = useRouter();
  const [pending, start] = useTransition();
  const toggle = () =>
    start(async () => {
      const r = await setBookingActionDone(bookingId, !done);
      if (!r.success) return void toast.error('Could not update the action', { description: r.error });
      toast.success(done ? 'Action reopened' : 'Action marked done');
      router.refresh();
    });
  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      className={cn(
        'inline-flex h-8 shrink-0 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors disabled:opacity-60',
        done ? 'bg-white text-muted-foreground hover:bg-muted hover:text-foreground' : 'border-emerald-200 bg-emerald-50 text-emerald-800 hover:bg-emerald-100',
        className
      )}
    >
      {pending ? <Loader2 className="size-3.5 animate-spin" /> : done ? <RotateCcw className="size-3.5" /> : <Check className="size-3.5" />}
      {done ? 'Reopen' : 'Mark done'}
    </button>
  );
}
