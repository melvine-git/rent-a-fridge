'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, textareaClass } from '@/components/app/field';
import { JobDrawer, type JobTarget } from '@/components/jobs/job-drawer';
import { EditBookingSheet } from './edit-booking-sheet';
import { cancelBooking } from '@/lib/actions';
import { Ban, Mail, MessageSquare, PackageCheck, Pencil, Truck } from 'lucide-react';
import type { BookingWithDetails, DeliveryChecklist, Staff, Unit } from '@/types';

interface Props {
  booking: BookingWithDetails;
  staff: Staff[];
  units: Unit[];
  deliveredChecklist?: DeliveryChecklist;
}

const outlineBtn = 'inline-flex h-9 items-center gap-1.5 rounded-md border bg-white px-3 text-sm font-medium hover:bg-muted';

export function BookingActions({ booking, staff, units, deliveredChecklist }: Props) {
  const router = useRouter();
  const [job, setJob] = useState<JobTarget | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [editKey, setEditKey] = useState(0);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isCancelling, startCancel] = useTransition();

  const active = booking.status === 'CONFIRMED' || booking.status === 'ON_HIRE';

  const doCancel = () =>
    startCancel(async () => {
      const result = await cancelBooking(booking.id, reason);
      if (result.success) {
        toast.success('Booking cancelled', { description: `${booking.unit.id} is free for those dates again.` });
        setCancelOpen(false);
        router.refresh();
      } else {
        toast.error('Could not cancel booking', { description: result.error });
      }
    });

  return (
    <>
      <button className={outlineBtn} onClick={() => toast.success('Confirmation email sent', { description: `Booking details sent to ${booking.customer.email || 'customer'}` })}>
        <Mail className="size-4" /> <span className="hidden xl:inline">Email</span>
      </button>
      <button className={outlineBtn} onClick={() => toast.success('SMS reminder sent', { description: `Reminder sent to ${booking.contactPhone}` })}>
        <MessageSquare className="size-4" /> <span className="hidden xl:inline">SMS</span>
      </button>
      {booking.status === 'CONFIRMED' && (
        <button className={`${outlineBtn} text-red-700 hover:bg-red-50`} onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" /> Cancel
        </button>
      )}
      {active && (
        <button
          className={outlineBtn}
          onClick={() => {
            setEditKey((k) => k + 1);
            setEditOpen(true);
          }}
        >
          <Pencil className="size-4" /> Edit
        </button>
      )}
      {booking.status === 'CONFIRMED' && (
        <Button onClick={() => setJob({ booking, type: 'delivery' })} className="h-9 gap-1.5 px-3 hover:bg-[var(--brand-red-dark)]">
          <Truck /> Record delivery
        </Button>
      )}
      {booking.status === 'ON_HIRE' && (
        <Button onClick={() => setJob({ booking, type: 'collection', deliveredChecklist })} className="h-9 gap-1.5 bg-emerald-600 px-3 hover:bg-emerald-700">
          <PackageCheck /> Record collection
        </Button>
      )}

      <JobDrawer
        job={job}
        staff={staff}
        onClose={() => setJob(null)}
        onCompleted={() => {
          setJob(null);
          router.refresh();
        }}
      />

      {active && (
        <EditBookingSheet
          key={editKey}
          booking={booking}
          units={units}
          open={editOpen}
          onOpenChange={setEditOpen}
          onSaved={() => {
            setEditOpen(false);
            router.refresh();
          }}
        />
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold">Cancel this booking?</DialogTitle>
            <DialogDescription>
              {booking.customer.name} · {booking.unit.id}. The scheduled delivery will be removed and the unit released for these dates. This can’t be undone.
            </DialogDescription>
          </DialogHeader>
          <Field label="Reason (optional)">
            <textarea value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. Event postponed by customer" className={textareaClass} />
          </Field>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} className="h-9 px-4">
              Keep booking
            </Button>
            <Button onClick={doCancel} disabled={isCancelling} className="h-9 bg-red-600 px-4 hover:bg-red-700">
              {isCancelling ? 'Cancelling…' : 'Cancel booking'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
