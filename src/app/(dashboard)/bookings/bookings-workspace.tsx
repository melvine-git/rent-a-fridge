'use client';

import { useState } from 'react';
import { BookingsCalendar, type PlannerView } from './bookings-calendar';
import { BookingsList } from './bookings-list';
import type { BookingListItem } from '@/lib/actions';
import type { BookingWithDetails, Unit } from '@/types';

/** Calendar planner with the bookings table as its alternate view. */
export function BookingsWorkspace({ bookings, allUnits, list, today }: { bookings: BookingWithDetails[]; allUnits: Unit[]; list: BookingListItem[]; today: string }) {
  const [view, setView] = useState<PlannerView>('timeline');

  return (
    <BookingsCalendar
      bookings={bookings}
      allUnits={allUnits}
      list={list}
      view={view}
      onView={setView}
      listSlot={<BookingsList list={list} today={today} />}
    />
  );
}
