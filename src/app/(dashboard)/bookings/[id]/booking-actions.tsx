'use client';

import { toast } from 'sonner';
import { Mail, MessageSquare } from 'lucide-react';

export function BookingActions({ email, phone }: { email?: string; phone: string }) {
  const btn = 'inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium hover:bg-muted';
  return (
    <>
      <button
        className={btn}
        onClick={() => toast.success('Confirmation email sent', { description: `Booking details sent to ${email || 'customer'}` })}
      >
        <Mail className="size-4" /> <span className="hidden sm:inline">Email confirmation</span>
      </button>
      <button className={btn} onClick={() => toast.success('SMS reminder sent', { description: `Reminder sent to ${phone}` })}>
        <MessageSquare className="size-4" /> <span className="hidden sm:inline">SMS reminder</span>
      </button>
    </>
  );
}
