import { PoundSterling } from 'lucide-react';
import { Pill } from '@/components/ui/status-badge';
import { paymentInfo } from '@/lib/domain';
import type { Booking } from '@/types';

/** Paid / On credit / Awaiting payment badge. Information only: it never blocks dispatch. */
export function PaymentPill({ lines, terms, className }: { lines: Pick<Booking, 'paymentStatus'>[]; terms?: 'ADVANCE' | 'CREDIT'; className?: string }) {
  const p = paymentInfo(lines, terms);
  return (
    <Pill tone={p.tone} className={className}>
      <PoundSterling className="-mx-0.5 size-3" />
      {p.label}
    </Pill>
  );
}
